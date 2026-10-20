using System.IO.Compression;
using System.Globalization;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Services;

// Reads only literal cells from the first worksheet. Formula cells are deliberately rejected.
public sealed class GoogleEmailImportReader : IGoogleEmailImportReader
{
    public List<string> Read(Stream stream)
    {
        try
        {
            using var zip = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
            if (zip.Entries.Count > 200 || zip.Entries.Sum(x => x.Length) > 10 * 1024 * 1024)
                throw new IdentityException(400, "Workbook exceeds the uncompressed size limit.");
            XNamespace sheetNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            XDocument Load(ZipArchiveEntry entry)
            {
                using var input = entry.Open();
                using var reader = XmlReader.Create(input, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 10 * 1024 * 1024 });
                return XDocument.Load(reader);
            }
            var sharedEntry = zip.GetEntry("xl/sharedStrings.xml");
            var shared = sharedEntry is null ? [] : Load(sharedEntry).Descendants(sheetNs + "si").Select(x => string.Concat(x.Descendants(sheetNs + "t").Select(t => t.Value))).ToArray();
            var workbook = Load(zip.GetEntry("xl/workbook.xml") ?? throw new IdentityException(400, "Invalid XLSX workbook."));
            XNamespace relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
            var id = workbook.Descendants(sheetNs + "sheet").FirstOrDefault()?.Attribute(relNs + "id")?.Value;
            var relations = Load(zip.GetEntry("xl/_rels/workbook.xml.rels") ?? throw new IdentityException(400, "Invalid XLSX workbook."));
            var target = relations.Root?.Elements().SingleOrDefault(x => x.Attribute("Id")?.Value == id)?.Attribute("Target")?.Value;
            var entry = zip.GetEntry(target?.StartsWith('/') == true ? target.TrimStart('/') : "xl/" + target) ?? throw new IdentityException(400, "Worksheet not found.");
            Dictionary<int, string> Cells(XElement row)
            {
                var values = new Dictionary<int, string>();
                foreach (var cell in row.Elements(sheetNs + "c"))
                {
                    if (cell.Element(sheetNs + "f") is not null) throw new IdentityException(400, "Formulas are not accepted in the import worksheet.");
                    var column = new string((cell.Attribute("r")?.Value ?? "").TakeWhile(char.IsLetter).ToArray());
                    if (string.IsNullOrWhiteSpace(column)) continue;
                    var value = cell.Element(sheetNs + "v")?.Value ?? string.Concat(cell.Descendants(sheetNs + "t").Select(t => t.Value));
                    values[ColumnIndex(column)] = (cell.Attribute("t")?.Value == "s" ? shared[int.Parse(value)] : value).Trim();
                }
                return values;
            }
            var rows = Load(entry).Descendants(sheetNs + "row").ToArray();
            var headerRow = -1;
            var emailColumn = -1;
            for (var index = 0; index < Math.Min(rows.Length, 30); index++)
            {
                var candidate = Cells(rows[index]);
                var match = candidate.FirstOrDefault(x => IsEmailHeader(x.Value));
                if (match.Value is null) continue;
                headerRow = index;
                emailColumn = match.Key;
                break;
            }
            if (headerRow < 0) throw new IdentityException(400, "Could not find an Email or Gmail column in the first 30 rows.");
            return rows.Skip(headerRow + 1).Select(Cells).Select(row => row.GetValueOrDefault(emailColumn, "")).Where(x => x.Length > 0).ToList();
        }
        catch (Exception ex) when (ex is InvalidDataException or XmlException or FormatException or IndexOutOfRangeException)
        { throw new IdentityException(400, "Invalid XLSX file."); }
    }
    private static bool IsEmailHeader(string value)
    {
        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(character))
                builder.Append(char.ToLowerInvariant(character));
        var header = builder.ToString().Replace('đ', 'd');
        return header == "email" || header == "gmail" || header.StartsWith("email") || header.Contains("gmail");
    }
    private static int ColumnIndex(string column)
    {
        var result = 0;
        foreach (var letter in column.ToUpperInvariant()) result = result * 26 + (letter - 'A' + 1);
        return result - 1;
    }
}
