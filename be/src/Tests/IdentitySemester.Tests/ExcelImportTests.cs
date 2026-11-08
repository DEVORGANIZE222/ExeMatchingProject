using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Xml.Linq;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Infrastructure.Services;
using EXETeamMatching.SharedKernel.Models;
using Xunit;

namespace EXETeamMatching.IdentitySemester.Tests;

public class ExcelImportTests
{
    public static byte[] WorkbookWithRosterLayout()
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            void Write(string path, string text) { using var writer = new StreamWriter(zip.CreateEntry(path).Open(), Encoding.UTF8); writer.Write(text); }
            Write("xl/workbook.xml", "<workbook xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='Group List' sheetId='1' r:id='rId1'/></sheets></workbook>");
            Write("xl/_rels/workbook.xml.rels", "<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Target='worksheets/sheet1.xml'/></Relationships>");
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            XElement Cell(string reference, string value) => new(ns + "c", new XAttribute("r", reference), new XAttribute("t", "inlineStr"), new XElement(ns + "is", new XElement(ns + "t", value)));
            var sheet = new XElement(ns + "sheetData",
                new XElement(ns + "row", new XAttribute("r", 1), Cell("B1", "File Status:"), Cell("C1", "CLOSE")),
                new XElement(ns + "row", new XAttribute("r", 5), Cell("F5", "Họ & Tên"), Cell("G5", "MSSV"), Cell("H5", "Email (email trên FAP của SV)"), Cell("I5", "Ngành"), Cell("J5", "SemesterCode")),
                new XElement(ns + "row", new XAttribute("r", 6), Cell("F6", "Lê Hữu Đại"), Cell("G6", "SE184118"), Cell("H6", "dai@example.edu"), Cell("I6", "Công nghệ thông tin"), Cell("J6", "FA26")));
            Write("xl/worksheets/sheet1.xml", new XDocument(new XElement(ns + "worksheet", sheet)).ToString());
        }
        return stream.ToArray();
    }
    public static byte[] Workbook(int count, bool formula = false, bool wrongHeader = false, string semesterCode = "EXCEL")
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            void Write(string path, string text)
            {
                using var writer = new StreamWriter(zip.CreateEntry(path).Open(), Encoding.UTF8);
                writer.Write(text);
            }
            Write("xl/workbook.xml", "<workbook xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='Students' sheetId='1' r:id='rId1'/></sheets></workbook>");
            Write("xl/_rels/workbook.xml.rels", "<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Target='worksheets/sheet1.xml'/></Relationships>");
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var data = new XElement(ns + "sheetData");
            void Row(int number, params string[] values) => data.Add(new XElement(ns + "row", new XAttribute("r", number), values.Select((v, i) =>
                new XElement(ns + "c", new XAttribute("r", ((char)('A' + i)).ToString() + number), new XAttribute("t", "inlineStr"), new XElement(ns + "is", new XElement(ns + "t", v))))));
            Row(1, wrongHeader ? "Invalid" : "StudentCode", "FullName", "Email", "Major", "SemesterCode");
            for (var i = 1; i <= count; i++) Row(i + 1, "EX" + i, "Nguyễn Văn " + i, "excel" + i + "@test.edu", "SE", semesterCode);
            if (formula) data.Elements().Last().Elements().First().Add(new XElement(ns + "f", "1+1"));
            Write("xl/worksheets/sheet1.xml", new XDocument(new XElement(ns + "worksheet", data)).ToString());
        }
        return stream.ToArray();
    }
    [Fact]
    public void Reads_200_students_and_preserves_Unicode()
    {
        using var stream = new MemoryStream(Workbook(200));
        var rows = new StudentImportReader().Read(stream);
        Assert.Equal(200, rows.Count);
        Assert.Equal("Nguyễn Văn 1", rows[0].FullName);
        Assert.Equal("EXCEL", rows[0].SemesterCode);
    }
    [Fact]
    public void Reads_roster_layout_with_notes_and_non_adjacent_vietnamese_headers()
    {
        using var stream = new MemoryStream(WorkbookWithRosterLayout());
        var rows = new StudentImportReader().Read(stream);
        Assert.Single(rows);
        Assert.Equal("SE184118", rows[0].StudentCode);
        Assert.Equal("Lê Hữu Đại", rows[0].FullName);
        Assert.Equal("dai@example.edu", rows[0].Email);
    }
    [Theory]
    [InlineData(0, false, false)]
    [InlineData(2001, false, false)]
    [InlineData(2, true, false)]
    [InlineData(2, false, true)]
    public void Rejects_invalid_workbooks(int count, bool formula, bool wrongHeader)
    {
        using var stream = new MemoryStream(Workbook(count, formula, wrongHeader));
        Assert.Throws<IdentityException>(() => new StudentImportReader().Read(stream));
    }
    [Fact]
    public void Rejects_non_zip_file()
    {
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("not a workbook"));
        Assert.Throws<IdentityException>(() => new StudentImportReader().Read(stream));
    }
}

public class ExcelApiTests(IdentityApiFixture fixture) : IClassFixture<IdentityApiFixture>
{
    [Fact]
    public async Task Multipart_import_200_students_works_and_duplicate_retry_is_conflict()
    {
        var created = await fixture.Admin.PostAsJsonAsync("/api/semesters", new CreateSemesterRequest("EXCEL", "Excel test",
            new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2027, 6, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        MultipartFormDataContent Form()
        {
            var form = new MultipartFormDataContent();
            form.Add(new ByteArrayContent(ExcelImportTests.Workbook(200, semesterCode: "EXCEL")), "file", "students.xlsx");
            form.Add(new StringContent("EXCEL"), "semesterCode");
            form.Add(new StringContent(IdentityApiFixture.Password), "initialPassword");
            return form;
        }
        using var form = Form();
        var response = await fixture.Admin.PostAsync("/api/students/import/excel", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(200, (await response.Content.ReadFromJsonAsync<ApiResponse<ImportResult>>())!.Data!.ImportedCount);
        using var duplicate = Form();
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Admin.PostAsync("/api/students/import/excel", duplicate)).StatusCode);
        var list = (await fixture.Admin.GetFromJsonAsync<ApiResponse<PageResult<StudentResponse>>>("/api/students?semesterCode=EXCEL&pageSize=100&page=2"))!.Data!;
        Assert.Equal(200, list.TotalCount);
        Assert.Equal(100, list.Items.Count);
    }
}
