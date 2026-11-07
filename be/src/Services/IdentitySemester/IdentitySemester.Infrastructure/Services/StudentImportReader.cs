using System.IO.Compression;
using System.Globalization;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Services;

// XLSX is an Open XML ZIP archive. Read only plain cell values; never execute formulas.
public class StudentImportReader : IStudentImportReader
{
    public List<StudentImportDto> Read(Stream stream)
    {
        try
        {
            using var zip = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
            if (zip.Entries.Count > 200 || zip.Entries.Sum(e => e.Length) > 25 * 1024 * 1024)
                throw new IdentityException(400, "Workbook exceeds the uncompressed size limit.");
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            XDocument Load(ZipArchiveEntry entry)
            {
                using var input = entry.Open();
                using var reader = XmlReader.Create(input, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 15 * 1024 * 1024 });
                return XDocument.Load(reader);
            }
            var stringsEntry = zip.GetEntry("xl/sharedStrings.xml");
            var strings = stringsEntry is null ? [] : Load(stringsEntry).Descendants(ns + "si").Select(s => string.Concat(s.Descendants(ns + "t").Select(t => t.Value))).ToArray();
            var workbook = Load(zip.GetEntry("xl/workbook.xml") ?? throw new IdentityException(400, "Invalid XLSX workbook."));
            XNamespace rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
            var sheetId = workbook.Descendants(ns + "sheet").FirstOrDefault()?.Attribute(rel + "id")?.Value;
            var relations = Load(zip.GetEntry("xl/_rels/workbook.xml.rels") ?? throw new IdentityException(400, "Invalid workbook relationships."));
            var target = relations.Root?.Elements().SingleOrDefault(e => e.Attribute("Id")?.Value == sheetId)?.Attribute("Target")?.Value;
            if (target is null) throw new IdentityException(400, "Worksheet not found.");
            var path = target.StartsWith('/') ? target.TrimStart('/') : "xl/" + target;
            var entry = zip.GetEntry(path) ?? throw new IdentityException(400, "Worksheet not found.");
            var rows = Load(entry).Descendants(ns + "row").ToArray();
            Dictionary<int, string> Cells(XElement row)
            {
                var values = new Dictionary<int, string>();
                foreach (var cell in row.Elements(ns + "c"))
                {
                    var column = new string((cell.Attribute("r")?.Value ?? "").TakeWhile(char.IsLetter).ToArray());
                    if (string.IsNullOrWhiteSpace(column)) continue;
                    var index = ColumnIndex(column);
                    var value = cell.Element(ns + "v")?.Value ?? string.Concat(cell.Descendants(ns + "t").Select(t => t.Value));
                    if (cell.Attribute("t")?.Value == "s" && int.TryParse(value, out var sIdx) && sIdx >= 0 && sIdx < strings.Length)
                        value = strings[sIdx];
                    values[index] = value?.Trim() ?? "";
                }
                return values;
            }
            if (rows.Length == 0) throw new IdentityException(400, "The first worksheet is empty.");
            // Teaching rosters commonly start with notes, deadlines, or an export title.
            // Find the first usable header in the opening area instead of assuming row 1.
            var headerRowIndex = -1;
            Dictionary<int, string>? header = null;
            for (var index = 0; index < Math.Min(rows.Length, 30); index++)
            {
                var candidate = Cells(rows[index]);
                var found = candidate.Values.Select(HeaderField).Where(x => x is not null).Cast<string>().ToHashSet(StringComparer.OrdinalIgnoreCase);
                if (new[] { "StudentCode", "FullName", "Email" }.All(found.Contains))
                {
                    headerRowIndex = index;
                    header = candidate;
                    break;
                }
            }
            if (header is null) throw new IdentityException(400, "Could not find a roster header with StudentCode/MSSV, FullName/Họ tên, and Email/Gmail.");
            var columns = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var (column, label) in header)
            {
                var field = HeaderField(label);
                if (field is not null && !columns.ContainsKey(field)) columns[field] = column;
            }
            var required = new[] { "StudentCode", "FullName", "Email" };
            if (required.Any(field => !columns.ContainsKey(field)))
                throw new IdentityException(400, "Could not find all required columns: StudentCode (or MSSV), FullName (or Họ tên), Email (or Gmail).");
            string Value(Dictionary<int, string> row, string field) => columns.TryGetValue(field, out var col) ? row.GetValueOrDefault(col, "").Trim() : "";
            // Group/project rows and incomplete roster lines cannot create an
            // account. Keep only complete rows from the required fields.
            var rawList = rows.Skip(headerRowIndex + 1).Select(Cells)
                .Where(r => required.All(field => Value(r, field).Length > 0))
                .Select(r => new StudentImportDto(
                    Value(r, "StudentCode").ToUpperInvariant(),
                    Value(r, "FullName"),
                    Value(r, "Email").ToLowerInvariant(),
                    string.IsNullOrWhiteSpace(Value(r, "Major")) ? "Chưa phân ngành" : Value(r, "Major"),
                    Value(r, "SemesterCode"))).ToList();
            
            // Deduplicate within file by StudentCode and Email
            var seenCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seenEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new List<StudentImportDto>();
            foreach (var s in rawList)
            {
                if (s.Email.Contains('@') && seenCodes.Add(s.StudentCode) && seenEmails.Add(s.Email))
                {
                    result.Add(s);
                }
            }

            if (result.Count is < 1 or > 5000) throw new IdentityException(400, "Import requires 1 to 5000 students.");
            return result;
        }
        catch (Exception ex) when (ex is InvalidDataException or XmlException or FormatException or IndexOutOfRangeException)
        { throw new IdentityException(400, "Invalid XLSX file."); }
    }
    private static int ColumnIndex(string column)
    {
        var result = 0;
        foreach (var letter in column.ToUpperInvariant()) result = result * 26 + (letter - 'A' + 1);
        return result - 1;
    }
    private static string? HeaderField(string value)
    {
        var header = Normalize(value);
        if (header.Contains("leader") || header.Contains("truongnhom")) return null;
        if (header is "studentcode" or "studentid" or "mssv" or "masv" or "code" || header.StartsWith("mssv") || header.StartsWith("masv") || header.Contains("mssv") || header.Contains("studentcode")) return "StudentCode";
        if (header is "fullname" or "hoten" or "name" or "studentname" || header.StartsWith("hoten") || header.Contains("hoten") || header.Contains("fullname")) return "FullName";
        if (header is "email" or "gmail" or "fptemail" or "studentemail" || header.StartsWith("email") || header.Contains("email") || header.Contains("gmail")) return "Email";
        if (header is "major" or "nganh" or "chuyennganh" or "specialization" or "program" || header.StartsWith("nganh") || header.StartsWith("chuyennganh") || header.Contains("nganh")) return "Major";
        if (header is "semestercode" or "semester" or "hockycode" or "mahocky" || header.StartsWith("hocky") || header.StartsWith("semester")) return "SemesterCode";
        return null;
    }
    private static string Normalize(string value)
    {
        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(character))
                builder.Append(char.ToLowerInvariant(character));
        return builder.ToString().Replace('đ', 'd');
    }
}
