import React, { useMemo, useRef } from 'react';
import { XCircle, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { Student, AppData } from '../types';

interface Props {
  student: Student | null;
  data: AppData;
  onClose: () => void;
}

export default function ParentReportModal({ student, data, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!student) return null;

  const studentGrades = data.grades.filter(g => g.studentId === student.id);
  const studentBehaviors = data.behaviors.filter(b => b.studentId === student.id);

  const subjectAverages = data.subjects.map(subject => {
    const grades = studentGrades.filter(g => g.subjectId === subject.id);
    const avg = grades.length > 0 ? grades.reduce((a, b) => a + b.value, 0) / grades.length : null;
    return { subject, avg };
  });

  const overallAvg = (() => {
    const validAvgs = subjectAverages.filter(s => s.avg !== null).map(s => s.avg!);
    return validAvgs.length > 0 ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length : null;
  })();

  const behaviorPoints = studentBehaviors.reduce((a, b) => a + b.points, 0);
  const behaviorScore = 100 + behaviorPoints;

  const getGradeLabel = (avg: number) => {
    if (avg >= 8) return 'Giỏi';
    if (avg >= 6.5) return 'Khá';
    if (avg >= 5) return 'Trung bình';
    return 'Yếu';
  };

  const getBehaviorLabel = (score: number) => {
    if (score >= 90) return 'Tốt';
    if (score >= 70) return 'Khá';
    if (score >= 50) return 'Trung bình';
    return 'Yếu';
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Phiếu điểm - ${student.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { text-align: center; color: #1e40af; }
            h2 { color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .info { display: flex; gap: 40px; margin: 16px 0; }
            .info span { font-weight: bold; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            .footer div { text-align: center; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportWord = async () => {
    try {
      const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
      const borderNone = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
      const thinBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      };

      const doc = new Document({
        styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: 'PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP', bold: true, size: 32, color: '1e40af' })],
            }),
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Họ tên: ', bold: true }),
                new TextRun({ text: student.name }),
                new TextRun({ text: '     Lớp: ', bold: true }),
                new TextRun({ text: student.class }),
              ],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: `Ngày lập: ${dayjs().format('DD/MM/YYYY')}` })],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'I. BẢNG ĐIỂM', bold: true })],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Môn học', bold: true })] })], borders: thinBorder }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Điểm TB', bold: true })] })], borders: thinBorder }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Xếp loại', bold: true })] })], borders: thinBorder }),
                  ],
                }),
                ...subjectAverages.map(sa =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun(sa.subject.name)] })], borders: thinBorder }),
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(sa.avg !== null ? sa.avg.toFixed(1) : '—')] })], borders: thinBorder }),
                      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(sa.avg !== null ? getGradeLabel(sa.avg) : '—')] })], borders: thinBorder }),
                    ],
                  })
                ),
              ],
            }),
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({ text: 'Điểm trung bình: ', bold: true }),
                new TextRun({ text: overallAvg !== null ? overallAvg.toFixed(1) : 'Chưa có' }),
                new TextRun({ text: overallAvg !== null ? ` (${getGradeLabel(overallAvg)})` : '' }),
              ],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'II. HẠNH KIỂM', bold: true })],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Điểm rèn luyện: ${behaviorScore}/100 — ` }),
                new TextRun({ text: getBehaviorLabel(behaviorScore), bold: true }),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Diem_${student.name.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex justify-between items-center sticky top-0 z-10">
            <h3 className="text-xl font-bold text-white">Phiếu báo cáo học tập</h3>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="p-2 text-white/70 hover:text-white transition-colors" title="In phiếu">
                <Printer size={20} />
              </button>
              <button onClick={handleExportWord} className="p-2 text-white/70 hover:text-white transition-colors" title="Xuất Word">
                <Download size={20} />
              </button>
              <button onClick={onClose} className="p-2 text-white/70 hover:text-white transition-colors">
                <XCircle size={20} />
              </button>
            </div>
          </div>

          {/* Content for print */}
          <div ref={printRef} className="p-8 space-y-6">
            <h1 style={{ textAlign: 'center', color: '#1e40af', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP
            </h1>

            <div className="flex gap-8 text-sm">
              <div><span className="font-bold">Họ tên:</span> {student.name}</div>
              <div><span className="font-bold">Lớp:</span> {student.class}</div>
              <div><span className="font-bold">Ngày lập:</span> {dayjs().format('DD/MM/YYYY')}</div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-700 border-b-2 border-slate-200 pb-2 mb-4">I. Bảng điểm</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-300 p-3 text-left font-bold">Môn học</th>
                    <th className="border border-slate-300 p-3 text-center font-bold">Điểm TB</th>
                    <th className="border border-slate-300 p-3 text-center font-bold">Xếp loại</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectAverages.map(sa => (
                    <tr key={sa.subject.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-3">{sa.subject.name}</td>
                      <td className="border border-slate-300 p-3 text-center font-bold">
                        {sa.avg !== null ? sa.avg.toFixed(1) : '—'}
                      </td>
                      <td className="border border-slate-300 p-3 text-center">
                        {sa.avg !== null ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            sa.avg >= 8 ? 'bg-green-100 text-green-700' :
                            sa.avg >= 6.5 ? 'bg-blue-100 text-blue-700' :
                            sa.avg >= 5 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {getGradeLabel(sa.avg)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200 flex justify-between items-center">
                <span className="font-bold text-slate-700">Điểm trung bình chung:</span>
                <span className="text-2xl font-black text-blue-700">
                  {overallAvg !== null ? `${overallAvg.toFixed(1)} (${getGradeLabel(overallAvg)})` : 'Chưa có dữ liệu'}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-700 border-b-2 border-slate-200 pb-2 mb-4">II. Hạnh kiểm</h2>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 flex justify-between items-center">
                <span className="font-bold text-slate-700">Điểm rèn luyện:</span>
                <span className="text-2xl font-black text-orange-700">
                  {behaviorScore}/100 ({getBehaviorLabel(behaviorScore)})
                </span>
              </div>
              {studentBehaviors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {studentBehaviors.slice(0, 5).map(b => (
                    <div key={b.id} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className={b.type === 'positive' ? 'text-green-600' : 'text-red-600'}>
                        {b.points > 0 ? `+${b.points}` : b.points}
                      </span>
                      {b.category} {b.note && `— ${b.note}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              <Printer size={18} /> In phiếu
            </button>
            <button onClick={handleExportWord} className="flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors">
              <Download size={18} /> Xuất Word
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
