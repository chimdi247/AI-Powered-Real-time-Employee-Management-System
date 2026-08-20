import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type {
  DepartmentActivitiesReport,
  EmployeePerformanceReport,
  LeaveStatisticsReport,
} from "@/types";

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

function addPdfHeader(
  doc: jsPDF,
  title: string,
  period: { from: string; to: string }
) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Period: ${period.from} to ${period.to}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US")}`, 14, 36);
  doc.setTextColor(0);
  return 44;
}

export function exportEmployeePerformancePDF(report: EmployeePerformanceReport) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addPdfHeader(doc, "Employee Performance Report", report.period);

  if (report.employees.length === 0) {
    doc.setFontSize(12);
    doc.text("No data available for the selected period.", 14, y + 10);
  } else {
    // Summary
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Employees: ${report.employees.length}`, 14, y + 4);
    y += 10;

    const avgRate =
      report.employees.reduce((sum, e) => sum + e.attendance.rate, 0) /
      report.employees.length;
    doc.setFont("helvetica", "normal");
    doc.text(`Average Attendance Rate: ${avgRate.toFixed(1)}%`, 14, y);
    y += 10;

    // Table
    const rows = report.employees.map((emp) => [
      emp.user.name,
      emp.departmentName ?? "Unassigned",
      `${emp.attendance.rate}%`,
      `${emp.attendance.present}`,
      `${emp.attendance.absent}`,
      `${emp.attendance.late}`,
      `${emp.leaves.total}`,
      `${emp.leaves.approvalRate}%`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Employee",
          "Department",
          "Att. Rate",
          "Present",
          "Absent",
          "Late",
          "Leaves",
          "Leave Approval",
        ],
      ],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  doc.save("employee-performance-report.pdf");
}

export function exportLeaveStatisticsPDF(report: LeaveStatisticsReport) {
  const doc = new jsPDF();
  let y = addPdfHeader(doc, "Leave Statistics Report", report.period);

  if (report.summary.total === 0) {
    doc.setFontSize(12);
    doc.text("No leave data available for the selected period.", 14, y + 10);
  } else {
    // Summary
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, y + 4);
    y += 10;

    doc.setFont("helvetica", "normal");
    const summaryRows = [
      ["Total Requests", String(report.summary.total)],
      ["Pending", String(report.summary.pending)],
      ["Approved", String(report.summary.approved)],
      ["Rejected", String(report.summary.rejected)],
      ["Cancelled", String(report.summary.cancelled)],
    ];
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Count"]],
      body: summaryRows,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
      tableWidth: 100,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;

    // By type
    if (report.byType.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("By Leave Type", 14, y);
      y += 4;

      const typeRows = report.byType.map((t) => [
        t.type.charAt(0).toUpperCase() + t.type.slice(1),
        String(t.count),
        String(t.approved),
        String(t.rejected),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Type", "Total", "Approved", "Rejected"]],
        body: typeRows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }
  }

  doc.save("leave-statistics-report.pdf");
}

export function exportDepartmentActivitiesPDF(
  report: DepartmentActivitiesReport
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addPdfHeader(doc, "Department Activities Report", report.period);

  if (report.departments.length === 0) {
    doc.setFontSize(12);
    doc.text("No department data available for the selected period.", 14, y + 10);
  } else {
    const rows = report.departments.map((dept) => [
      dept.name,
      String(dept.memberCount),
      `${dept.avgAttendanceRate}%`,
      String(dept.leaveDaysUsed),
      String(dept.recentActivities),
    ]);

    autoTable(doc, {
      startY: y + 4,
      head: [
        [
          "Department",
          "Members",
          "Avg Attendance",
          "Leave Days",
          "Activities",
        ],
      ],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  doc.save("department-activities-report.pdf");
}

// ---------------------------------------------------------------------------
// Excel Export
// ---------------------------------------------------------------------------

export function exportEmployeePerformanceExcel(
  report: EmployeePerformanceReport
) {
  const wb = XLSX.utils.book_new();

  if (report.employees.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["No data available for the selected period."],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Performance");
  } else {
    const data = report.employees.map((emp) => ({
      Employee: emp.user.name,
      Email: emp.user.email,
      Department: emp.departmentName ?? "Unassigned",
      "Attendance Rate": `${emp.attendance.rate}%`,
      Present: emp.attendance.present,
      Absent: emp.attendance.absent,
      Late: emp.attendance.late,
      "Half Day": emp.attendance.half_day,
      "On Leave": emp.attendance.on_leave,
      "Annual Leaves": emp.leaves.annual,
      "Sick Leaves": emp.leaves.sick,
      "Personal Leaves": emp.leaves.personal,
      "Unpaid Leaves": emp.leaves.unpaid,
      "Total Leaves": emp.leaves.total,
      "Leave Approval Rate": `${emp.leaves.approvalRate}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-width columns.
    const colWidths = Object.keys(data[0] ?? {}).map((key) => ({
      wch: Math.max(key.length + 2, 12),
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Performance");
  }

  XLSX.writeFile(wb, "employee-performance-report.xlsx");
}

export function exportLeaveStatisticsExcel(report: LeaveStatisticsReport) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["Metric", "Count"],
    ["Total Requests", report.summary.total],
    ["Pending", report.summary.pending],
    ["Approved", report.summary.approved],
    ["Rejected", report.summary.rejected],
    ["Cancelled", report.summary.cancelled],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // By type sheet
  if (report.byType.length > 0) {
    const typeData = report.byType.map((t) => ({
      Type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
      Total: t.count,
      Approved: t.approved,
      Rejected: t.rejected,
    }));
    const typeWs = XLSX.utils.json_to_sheet(typeData);
    XLSX.utils.book_append_sheet(wb, typeWs, "By Type");
  }

  // By department sheet
  if (report.byDepartment.length > 0) {
    const deptData = report.byDepartment.map((d) => ({
      Department: d.department,
      Total: d.total,
      Approved: d.approved,
      Rejected: d.rejected,
    }));
    const deptWs = XLSX.utils.json_to_sheet(deptData);
    XLSX.utils.book_append_sheet(wb, deptWs, "By Department");
  }

  // Monthly trend sheet
  if (report.monthlyTrend.length > 0) {
    const trendData = report.monthlyTrend.map((m) => ({
      Month: m.month,
      Total: m.total,
      Approved: m.approved,
      Rejected: m.rejected,
    }));
    const trendWs = XLSX.utils.json_to_sheet(trendData);
    XLSX.utils.book_append_sheet(wb, trendWs, "Monthly Trend");
  }

  XLSX.writeFile(wb, "leave-statistics-report.xlsx");
}

export function exportDepartmentActivitiesExcel(
  report: DepartmentActivitiesReport
) {
  const wb = XLSX.utils.book_new();

  if (report.departments.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["No department data available for the selected period."],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Departments");
  } else {
    const data = report.departments.map((dept) => ({
      Department: dept.name,
      Members: dept.memberCount,
      "Avg Attendance Rate": `${dept.avgAttendanceRate}%`,
      "Leave Days Used": dept.leaveDaysUsed,
      "Recent Activities": dept.recentActivities,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0] ?? {}).map((key) => ({
      wch: Math.max(key.length + 2, 14),
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Departments");
  }

  XLSX.writeFile(wb, "department-activities-report.xlsx");
}
