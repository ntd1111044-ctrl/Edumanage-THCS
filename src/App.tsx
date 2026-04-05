/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ShieldCheck,
  BarChart3,
  Settings,
  Plus,
  Search,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Download,
  Upload,
  Moon,
  Sun,
  Key,
  ChevronRight,
  Calculator,
  BookOpen,
  Languages,
  Zap,
  FlaskConical,
  MoreVertical,
  FileSpreadsheet,
  Trash2,
  Save,
  Target,
  Clock,
  Calendar,
  Wallet,
  CalendarCheck,
  CheckSquare,
  Presentation,
  Printer,
  LogOut,
  Lock,
  Eye,
  UserCheck,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Marked } from 'marked';
import Swal from 'sweetalert2';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

import { cn } from './lib/utils';
import { Student, Subject, Grade, BehaviorRecord, AppData, INITIAL_DATA } from './types';
import { callGeminiAI, MODELS } from './lib/gemini';
import AttendanceTab from './components/AttendanceTab';
import FundsTab from './components/FundsTab';
import TasksTab from './components/TasksTab';
import SeatingTab from './components/SeatingTab';
import ParentReportModal from './components/ParentReportModal';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

dayjs.extend(relativeTime);
dayjs.locale('vi');
const marked = new Marked();

export default function App() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('edumanage_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...INITIAL_DATA,
        ...parsed,
        // Ensure new arrays are initialized if loading from an older local storage state
        targetSchools: parsed.targetSchools || [],
        mockExams: parsed.mockExams || [],
        funds: parsed.funds || [],
        attendance: parsed.attendance || [],
        tasks: parsed.tasks || [],
        submissions: parsed.submissions || [],
        admissionScores2025: parsed.admissionScores2025 || []
      };
    }
    return INITIAL_DATA;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'grades' | 'behavior' | 'stats' | 'ai' | 'settings' | 'admission' | 'funds' | 'attendance' | 'tasks' | 'seating'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [admissionStudentId, setAdmissionStudentId] = useState<string>('');
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(() => {
    const savedRole = localStorage.getItem('edumanage_role');
    return savedRole === 'teacher' || savedRole === 'student' ? savedRole : null;
  });

  const isTeacher = userRole === 'teacher';
  const teacherPassword = data.settings.teacherPassword || '1234';

  // Show modal if no API key is provided
  useEffect(() => {
    if (!data.settings.apiKey && userRole === 'teacher') {
      setShowApiModal(true);
    }
  }, [userRole]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('edumanage_data', JSON.stringify(data));
  }, [data]);

  const classes = useMemo(() => ['All', ...Array.from(new Set(data.students.map(s => s.class)))], [data.students]);

  const filteredStudents = useMemo(() => {
    return data.students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClass === 'All' || s.class === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [data.students, searchTerm, selectedClass]);

  // --- Actions ---
  const addBehavior = (studentId: string, type: 'positive' | 'negative', category: string, points: number, note: string) => {
    const newRecord: BehaviorRecord = {
      id: Math.random().toString(36).substr(2, 9),
      studentId,
      type,
      category,
      points: type === 'positive' ? points : -points,
      note,
      date: new Date().toISOString(),
      subjectId: 'general'
    };

    setData(prev => ({
      ...prev,
      behaviors: [newRecord, ...prev.behaviors]
    }));

    Swal.fire({
      title: type === 'positive' ? 'Khen thưởng!' : 'Ghi nhận vi phạm',
      text: `${type === 'positive' ? 'Cộng' : 'Trừ'} ${points} điểm rèn luyện cho học sinh.`,
      icon: type === 'positive' ? 'success' : 'warning',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const addGrade = (studentId: string, subjectId: string, type: Grade['type'], value: number) => {
    const newGrade: Grade = {
      id: Math.random().toString(36).substr(2, 9),
      studentId,
      subjectId,
      type,
      value,
      date: new Date().toISOString()
    };

    setData(prev => ({
      ...prev,
      grades: [...prev.grades, newGrade]
    }));

    Swal.fire({
      title: 'Đã lưu điểm!',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const generateAIReport = async (studentId: string) => {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;

    const studentGrades = data.grades.filter(g => g.studentId === studentId);
    const studentBehaviors = data.behaviors.filter(b => b.studentId === studentId);

    const prompt = `
      Hãy đóng vai một giáo viên chủ nhiệm THCS tại Việt Nam. 
      Viết một bản nhận xét chi tiết và lời khuyên cho học sinh sau:
      Tên: ${student.name}
      Lớp: ${student.class}
      
      Dữ liệu điểm số: ${JSON.stringify(studentGrades.map(g => ({ subject: g.subjectId, value: g.value, type: g.type })))}
      Dữ liệu nề nếp: ${JSON.stringify(studentBehaviors.map(b => ({ category: b.category, points: b.points, note: b.note })))}
      
      Yêu cầu:
      1. Nhận xét về học lực (điểm trung bình, môn mạnh, môn yếu).
      2. Nhận xét về hạnh kiểm (thái độ, nề nếp).
      3. Đưa ra 3 lời khuyên cụ thể để học sinh tiến bộ hơn.
      4. Viết bằng tiếng Việt, giọng văn khích lệ, chuyên nghiệp.
      5. Định dạng Markdown.
    `;

    setIsLoadingAI(true);
    setAiResponse('');
    setActiveTab('ai');

    try {
      const response = await callGeminiAI(prompt, data.settings.apiKey, data.settings.selectedModel);
      setAiResponse(response);
    } catch (error: any) {
      const errorMsg = error.message;
      setAiResponse(`### <span style="color:red">Đã dừng do lỗi</span>\n\n**Chi tiết lỗi từ API:** \n\`${errorMsg}\``);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.students.map(s => {
      const studentGrades = data.grades.filter(g => g.studentId === s.id);
      const avgGrade = studentGrades.length > 0
        ? (studentGrades.reduce((acc, curr) => acc + curr.value, 0) / studentGrades.length).toFixed(2)
        : 'N/A';
      const behaviorPoints = data.behaviors.filter(b => b.studentId === s.id).reduce((acc, curr) => acc + curr.points, 0);

      return {
        'Họ tên': s.name,
        'Lớp': s.class,
        'Điểm TB': avgGrade,
        'Điểm rèn luyện': 100 + behaviorPoints
      };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo tổng hợp");
    XLSX.writeFile(wb, `Bao_cao_EduManage_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const downloadStudentTemplate = () => {
    const templateData = [
      { 'STT': 1, 'Họ tên': 'Nguyễn Văn A', 'Lớp': '9A1' },
      { 'STT': 2, 'Họ tên': 'Trần Thị B', 'Lớp': '9A1' },
      { 'STT': 3, 'Họ tên': 'Lê Văn C', 'Lớp': '9A2' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học sinh');
    XLSX.writeFile(wb, 'Mau_Nhap_Hoc_Sinh.xlsx');
    Swal.fire({ title: 'Tải thành công!', text: 'File mẫu danh sách học sinh đã được tải về.', icon: 'success', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
  };

  const downloadGradeTemplate = () => {
    const subjectNames = data.subjects.map(s => s.name);
    const sampleStudents = data.students.length > 0
      ? data.students.slice(0, 3).map((s, i) => {
        const row: Record<string, any> = { 'STT': i + 1, 'Họ tên': s.name };
        subjectNames.forEach(name => { row[name] = ''; });
        return row;
      })
      : [
        (() => { const r: Record<string, any> = { 'STT': 1, 'Họ tên': 'Nguyễn Văn A' }; subjectNames.forEach(n => { r[n] = 8.5; }); return r; })(),
        (() => { const r: Record<string, any> = { 'STT': 2, 'Họ tên': 'Trần Thị B' }; subjectNames.forEach(n => { r[n] = 7.0; }); return r; })(),
        (() => { const r: Record<string, any> = { 'STT': 3, 'Họ tên': 'Lê Văn C' }; subjectNames.forEach(n => { r[n] = 9.0; }); return r; })(),
      ];
    const ws = XLSX.utils.json_to_sheet(sampleStudents);
    ws['!cols'] = [{ wch: 5 }, { wch: 25 }, ...subjectNames.map(() => ({ wch: 12 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng điểm');
    XLSX.writeFile(wb, 'Mau_Nhap_Diem.xlsx');
    Swal.fire({ title: 'Tải thành công!', text: 'File mẫu nhập điểm đã được tải về.', icon: 'success', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
  };

  const exportAIToWord = async () => {
    if (!aiResponse) return;

    try {
      // Create document
      const doc = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 24 } } },
          paragraphStyles: [
            { id: "Normal", name: "Normal", run: { font: "Arial", size: 24 } },
            {
              id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
              run: { size: 32, bold: true, color: "000000" },
              paragraph: { spacing: { before: 240, after: 120 } }
            },
            {
              id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
              run: { size: 28, bold: true, color: "000000" },
              paragraph: { spacing: { before: 240, after: 120 } }
            },
            {
              id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal",
              run: { size: 24, bold: true, color: "000000" },
              paragraph: { spacing: { before: 240, after: 120 } }
            },
          ]
        },
        sections: [{
          properties: {},
          children: aiResponse.split('\n').filter(line => line.trim() !== '').map(line => {
            if (line.startsWith('### ')) {
              return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.replace('### ', ''))] });
            } else if (line.startsWith('## ')) {
              return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.replace('## ', ''))] });
            } else if (line.startsWith('# ')) {
              return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.replace('# ', ''))] });
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              return new Paragraph({
                bullet: { level: 0 },
                children: parseInlineMarkdown(line.substring(2))
              });
            } else {
              return new Paragraph({ children: parseInlineMarkdown(line) });
            }
          })
        }]
      });

      // To Buffer and save
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Nhan_Xet_${dayjs().format('YYYYMMDD')}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      Swal.fire('Thành công', 'Đầy xuất file Word thành công!', 'success');
    } catch (e: any) {
      console.error(e);
      Swal.fire('Lỗi', 'Không thể tạo file Word: ' + e.message, 'error');
    }
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let nameIdx = 0;
        let classIdx = 1;
        let startIndex = 0;

        if (rows[0]) {
          const headerRow = rows[0].map(c => String(c).toLowerCase().trim());
          const foundNameIdx = headerRow.findIndex(c => c.includes('tên') || c.includes('name') || c.includes('họ'));
          const foundClassIdx = headerRow.findIndex(c => c.includes('lớp') || c.includes('class'));

          if (foundNameIdx !== -1) {
            nameIdx = foundNameIdx;
            startIndex = 1;
          } else {
            // Fallback assumption: if it has 3 columns, STT is 0, Name is 1, Class is 2
            if (rows[0].length >= 3) {
              nameIdx = 1;
              classIdx = 2;
            }
          }
          if (foundClassIdx !== -1) {
            classIdx = foundClassIdx;
          }
        }

        const newStudents: Student[] = [];
        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[nameIdx]) continue; // Skip empty rows or rows without name

          newStudents.push({
            id: Math.random().toString(36).substr(2, 9),
            name: String(row[nameIdx]),
            class: row[classIdx] ? String(row[classIdx]) : 'Chưa phân lớp'
          });
        }

        if (newStudents.length > 0) {
          setData(prev => ({
            ...prev,
            students: [...prev.students, ...newStudents]
          }));
          Swal.fire('Thành công', `Đã nhập ${newStudents.length} học sinh từ Excel`, 'success');
        } else {
          Swal.fire('Chú ý', 'Không tìm thấy dữ liệu hợp lệ trong file', 'warning');
        }
      } catch (err: any) {
        Swal.fire('Lỗi', 'Không thể đọc file Excel. Định dạng không hợp lệ.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input value
    e.target.value = '';
  };

  const importGradesFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rows.length < 2) throw new Error('File không có dữ liệu hợp lệ');

        const headerRow = rows[0].map(c => String(c).toLowerCase().trim());
        const nameIdx = headerRow.findIndex(c => c.includes('tên') || c.includes('họ'));
        const finalNameIdx = nameIdx === -1 ? 1 : nameIdx; // fallback to 1

        const subjectCols: { colIdx: number, subjectId: string }[] = [];
        data.subjects.forEach(subj => {
          const sName = subj.name.toLowerCase();
          const colIdx = headerRow.findIndex(c => c.includes(sName));
          if (colIdx !== -1) {
            subjectCols.push({ colIdx, subjectId: subj.id });
          }
        });

        if (subjectCols.length === 0) {
          Swal.fire('Chú ý', 'Không tìm thấy tên cột tương ứng học phần nào trong file (vd: "Toán học", "Ngữ văn").', 'warning');
          return;
        }

        const newGrades: Grade[] = [];
        let importedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[finalNameIdx]) continue;

          const studentName = String(row[finalNameIdx]).trim().toLowerCase();
          const student = data.students.find(s => s.name.toLowerCase() === studentName);

          if (student) {
            let addedForStudent = false;
            subjectCols.forEach(({ colIdx, subjectId }) => {
              let val = row[colIdx];
              if (val !== undefined && val !== null && val !== '') {
                const numVal = parseFloat(String(val).replace(',', '.'));
                if (!isNaN(numVal) && numVal >= 0 && numVal <= 10) {
                  newGrades.push({
                    id: Math.random().toString(36).substr(2, 9),
                    studentId: student.id,
                    subjectId,
                    type: 'regular',
                    value: numVal,
                    date: new Date().toISOString()
                  });
                  addedForStudent = true;
                }
              }
            });
            if (addedForStudent) importedCount++;
          }
        }

        if (newGrades.length > 0) {
          setData(prev => ({
            ...prev,
            grades: [...prev.grades, ...newGrades]
          }));
          Swal.fire('Thành công', `Đã nhập ${newGrades.length} cột điểm cho ${importedCount} học sinh`, 'success');
        } else {
          Swal.fire('Chú ý', 'Không có điểm nào được cập nhật. Bạn cần đảm bảo cột Tên học sinh phải khớp và đúng tên học phần.', 'warning');
        }
      } catch (err: any) {
        Swal.fire('Lỗi', 'Không thể đọc file Excel. ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const downloadAdmissionScoresTemplate = () => {
    const templateData = [
      { 'STT': 1, 'Tên trường': 'THPT Chuyên Lê Hồng Phong', 'Điểm chuẩn': 24.5 },
      { 'STT': 2, 'Tên trường': 'THPT Nguyễn Thượng Hiền', 'Điểm chuẩn': 23.0 },
      { 'STT': 3, 'Tên trường': 'THPT Gia Định', 'Điểm chuẩn': 22.5 },
      { 'STT': 4, 'Tên trường': 'THPT Lê Quý Đôn', 'Điểm chuẩn': 22.0 },
      { 'STT': 5, 'Tên trường': 'THPT Mạc Đĩnh Chi', 'Điểm chuẩn': 21.0 },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Điểm chuẩn');
    XLSX.writeFile(wb, 'Mau_Diem_Chuan_2025.xlsx');
    Swal.fire({ title: 'Tải thành công!', text: 'File định dạng điểm chuẩn tĩnh đã được tải về.', icon: 'success', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
  };

  const importAdmissionScoresFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rows.length < 2) throw new Error('File không có dữ liệu hợp lệ');

        const headerRow = rows[0].map(c => String(c).toLowerCase().trim());
        const nameIdx = headerRow.findIndex(c => c.includes('tên') || c.includes('trường') || c.includes('school'));
        const scoreIdx = headerRow.findIndex(c => c.includes('điểm') || c.includes('chuẩn') || c.includes('score'));

        if (nameIdx === -1 || scoreIdx === -1) {
          Swal.fire('Chú ý', 'Không tìm thấy cột "Tên trường" hoặc "Điểm chuẩn" hợp lệ trong file.', 'warning');
          return;
        }

        const newScores = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[nameIdx] || row[scoreIdx] === undefined) continue;

          const name = String(row[nameIdx]).trim();
          let score = parseFloat(String(row[scoreIdx]).replace(',', '.'));

          if (name && !isNaN(score)) {
            newScores.push({
              id: Math.random().toString(36).substr(2, 9),
              name,
              targetScore: score
            });
          }
        }

        if (newScores.length > 0) {
          setData(prev => ({
            ...prev,
            admissionScores2025: newScores
          }));
          Swal.fire('Thành công', `Đã cập nhật ${newScores.length} trường chuẩn`, 'success');
        } else {
          Swal.fire('Chú ý', 'Không tìm thấy dữ liệu điểm chuẩn nào hợp lệ.', 'warning');
        }
      } catch (err: any) {
        Swal.fire('Lỗi', 'Không thể đọc file Excel. ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleUpdateAvatar = (studentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_SIZE = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setData(prev => ({
            ...prev,
            students: prev.students.map(s => s.id === studentId ? { ...s, avatar: compressedBase64 } : s)
          }));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Helper to parse **bold** and *italic* simply
  const parseInlineMarkdown = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    let currentPart = '';
    let isBold = false;
    let isItalic = false;

    // A very rudimentary parser for **bold**
    const parts = text.split(/(\*\*.*?\*\*|\*[^*]+\*)/g);

    parts.forEach(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        runs.push(new TextRun({ text: part.substring(2, part.length - 2), bold: true }));
      } else if (part.startsWith('*') && part.endsWith('*')) {
        runs.push(new TextRun({ text: part.substring(1, part.length - 1), italics: true }));
      } else if (part.length > 0) {
        runs.push(new TextRun({ text: part }));
      }
    });

    return runs.length > 0 ? runs : [new TextRun(text)];
  };

  // --- Components ---

  const SidebarItem = ({ id, icon: Icon, label, teacherOnly }: { id: typeof activeTab, icon: any, label: string, teacherOnly?: boolean }) => {
    if (teacherOnly && !isTeacher) return null;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={cn(
          "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200",
          activeTab === id
            ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <Icon size={20} />
        <span className={cn("font-medium", !isSidebarOpen && "hidden")}>{label}</span>
      </button>
    );
  };

  const handleLogin = (role: 'teacher' | 'student', password?: string) => {
    if (role === 'teacher') {
      if (password !== teacherPassword) {
        Swal.fire('Sai mật khẩu', 'Mật khẩu giáo viên không đúng. Vui lòng thử lại.', 'error');
        return;
      }
    }
    setUserRole(role);
    localStorage.setItem('edumanage_role', role);
  };

  const handleLogout = () => {
    setUserRole(null);
    localStorage.removeItem('edumanage_role');
    setActiveTab('dashboard');
  };

  // --- Login Screen ---
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-blue-500/30">
              <GraduationCap size={40} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">EduManage</h1>
            <p className="text-blue-300/70 mt-2 text-lg">Hệ thống quản lý lớp học thông minh</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white text-center mb-6">Chọn vai trò của bạn</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => {
                  Swal.fire({
                    title: 'Đăng nhập Giáo viên',
                    input: 'password',
                    inputLabel: 'Nhập mật khẩu GV',
                    inputPlaceholder: 'Mật khẩu...',
                    showCancelButton: true,
                    confirmButtonText: 'Đăng nhập',
                    cancelButtonText: 'Hủy',
                    confirmButtonColor: '#2563eb',
                    inputAttributes: { autocapitalize: 'off' },
                  }).then((result) => {
                    if (result.isConfirmed) {
                      handleLogin('teacher', result.value);
                    }
                  });
                }}
                className="group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400/60 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Shield size={32} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Giáo viên</p>
                  <p className="text-blue-300/60 text-xs mt-1">Toàn quyền chỉnh sửa</p>
                </div>
              </button>
              <button
                onClick={() => handleLogin('student')}
                className="group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-green-400/30 bg-green-500/10 hover:bg-green-500/20 hover:border-green-400/60 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
                  <Eye size={32} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Học sinh</p>
                  <p className="text-green-300/60 text-xs mt-1">Chỉ được xem</p>
                </div>
              </button>
            </div>
            <p className="text-center text-white/30 text-xs">Liên hệ giáo viên chủ nhiệm để lấy mật khẩu</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-orange-500 flex items-center justify-center text-white shrink-0">
            <GraduationCap size={24} />
          </div>
          {isSidebarOpen && <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-orange-600">Diem's class</h1>}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <SidebarItem id="dashboard" icon={LayoutDashboard} label="Tổng quan" />
          <SidebarItem id="students" icon={Users} label="Học sinh" />
          <SidebarItem id="grades" icon={GraduationCap} label="Điểm số" />
          <SidebarItem id="behavior" icon={ShieldCheck} label="Nề nếp" teacherOnly />
          <SidebarItem id="admission" icon={Target} label="Tuyển sinh 10" />
          <SidebarItem id="attendance" icon={CalendarCheck} label="Điểm danh" />
          <SidebarItem id="tasks" icon={CheckSquare} label="Bài tập" />
          <SidebarItem id="funds" icon={Wallet} label="Quỹ lớp" />
          <SidebarItem id="seating" icon={Presentation} label="Sơ đồ lớp" />
          <SidebarItem id="stats" icon={BarChart3} label="Thống kê" />
          <SidebarItem id="ai" icon={MessageSquare} label="AI Tutor" teacherOnly />
        </nav>

        <div className="p-3 border-t border-slate-100">
          <SidebarItem id="settings" icon={Settings} label="Cài đặt" teacherOnly />
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut size={20} />
            <span className={cn("font-medium", !isSidebarOpen && "hidden")}>Đăng xuất</span>
          </button>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mt-2 flex items-center justify-center w-full p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronRight className={cn("transition-transform duration-300", isSidebarOpen && "rotate-180")} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Tìm kiếm học sinh..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 rounded-lg outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-slate-100 border-transparent rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-blue-500"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map(c => <option key={c} value={c}>{c === 'All' ? 'Tất cả lớp' : c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {isTeacher && (
              <button
                onClick={() => {
                  setShowApiModal(true);
                  setActiveTab('settings');
                }}
                className="flex flex-col items-center justify-center px-4 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors shrink-0"
              >
                <div className="flex items-center gap-2 text-red-700 text-sm font-bold">
                  <Key size={14} />
                  Settings (API Key)
                </div>
                <span className="text-xs text-red-500 mt-0.5">Lấy API key để sử dụng app</span>
              </button>
            )}
            {isTeacher && (
              <button onClick={exportToExcel} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                <Download size={20} />
              </button>
            )}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold shrink-0",
              isTeacher ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
            )}>
              {isTeacher ? <Shield size={16} /> : <Eye size={16} />}
              {isTeacher ? 'Giáo viên' : 'Học sinh'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    title="Tổng học sinh"
                    value={data.students.length}
                    icon={Users}
                    color="blue"
                    trend="+2 tháng này"
                  />
                  <StatCard
                    title="Điểm TB khối"
                    value={(data.grades.reduce((a, b) => a + b.value, 0) / (data.grades.length || 1)).toFixed(1)}
                    icon={TrendingUp}
                    color="green"
                    trend="+0.2 so với kỳ trước"
                  />
                  <StatCard
                    title="Vi phạm nề nếp"
                    value={data.behaviors.filter(b => b.type === 'negative').length}
                    icon={AlertCircle}
                    color="orange"
                    trend="-15% so với tuần trước"
                  />
                  <StatCard
                    title="Khen thưởng AI"
                    value={data.behaviors.filter(b => b.type === 'positive').length}
                    icon={Award}
                    color="purple"
                    trend="12 học sinh mới"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Xu hướng học tập</h3>
                    <div className="h-80">
                      <Line
                        data={(() => {
                          const sortedGrades = [...data.grades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          const chunkSize = Math.max(1, Math.ceil(sortedGrades.length / 6));
                          const chunks: number[][] = [];
                          for (let i = 0; i < sortedGrades.length; i += chunkSize) {
                            chunks.push(sortedGrades.slice(i, i + chunkSize).map(g => g.value));
                          }
                          const labels = chunks.length > 0 ? chunks.map((_, i) => `Giai đoạn ${i + 1}`) : ['Chưa có dữ liệu'];
                          const avgData = chunks.length > 0 ? chunks.map(c => parseFloat((c.reduce((a, b) => a + b, 0) / c.length).toFixed(1))) : [0];
                          return {
                            labels,
                            datasets: [{
                              label: 'Điểm trung bình',
                              data: avgData,
                              borderColor: '#2563eb',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              fill: true,
                              tension: 0.4
                            }]
                          };
                        })()}
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Phân bổ hạnh kiểm</h3>
                    <div className="h-80 flex items-center justify-center">
                      <Doughnut
                        data={(() => {
                          let tot = 0, kha = 0, tb = 0, yeu = 0;
                          data.students.forEach(s => {
                            const pts = data.behaviors.filter(b => b.studentId === s.id).reduce((a, b) => a + b.points, 0);
                            const score = 100 + pts;
                            if (score >= 90) tot++;
                            else if (score >= 70) kha++;
                            else if (score >= 50) tb++;
                            else yeu++;
                          });
                          return {
                            labels: ['Tốt', 'Khá', 'Trung bình', 'Yếu'],
                            datasets: [{
                              data: [tot, kha, tb, yeu],
                              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                              borderWidth: 0
                            }]
                          };
                        })()}
                        options={{ cutout: '70%', plugins: { legend: { position: 'bottom' } } }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Hoạt động gần đây</h3>
                    <button className="text-blue-600 text-sm font-medium hover:underline">Xem tất cả</button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {data.behaviors.slice(0, 5).map(b => {
                      const student = data.students.find(s => s.id === b.studentId);
                      return (
                        <div key={b.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                            b.type === 'positive' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                          )}>
                            {b.type === 'positive' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">
                              {student?.name} <span className="text-slate-500 font-normal">được ghi nhận</span> {b.category}
                            </p>
                            <p className="text-sm text-slate-400">{dayjs(b.date).fromNow()} • {b.note}</p>
                          </div>
                          <div className={cn("font-bold", b.type === 'positive' ? "text-green-600" : "text-red-600")}>
                            {b.points > 0 ? `+${b.points}` : b.points}
                          </div>
                        </div>
                      );
                    })}
                    {data.behaviors.length === 0 && (
                      <div className="p-12 text-center text-slate-400">Chưa có hoạt động nào được ghi nhận.</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div
                key="students"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Danh sách học sinh</h2>
                  {isTeacher && (
                    <div className="flex gap-3">
                      <button
                        onClick={downloadStudentTemplate}
                        className="flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors font-medium shadow-sm"
                        title="Tải file Excel mẫu danh sách học sinh"
                      >
                        <FileSpreadsheet size={20} />
                        Tải file mẫu
                      </button>
                      <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-50 transition-colors cursor-pointer font-medium shadow-sm">
                        <Upload size={20} />
                        Nhập từ Excel
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          className="hidden"
                          onChange={importFromExcel}
                        />
                      </label>
                      <button
                        onClick={() => {
                          Swal.fire({
                            title: 'Thêm học sinh mới',
                            html: `
                              <input id="swal-student-name" class="swal2-input" placeholder="Họ tên (VD: Nguyễn Văn F)">
                              <input id="swal-student-class" class="swal2-input" placeholder="Lớp (VD: 9A1)">
                            `,
                            focusConfirm: false,
                            showCancelButton: true,
                            confirmButtonText: 'Thêm',
                            cancelButtonText: 'Hủy',
                            preConfirm: () => {
                              const name = (document.getElementById('swal-student-name') as HTMLInputElement).value.trim();
                              const cls = (document.getElementById('swal-student-class') as HTMLInputElement).value.trim();
                              if (!name || !cls) {
                                Swal.showValidationMessage('Vui lòng nhập đầy đủ họ tên và lớp');
                                return;
                              }
                              return { name, class: cls };
                            }
                          }).then((result) => {
                            if (result.isConfirmed && result.value) {
                              setData(prev => ({
                                ...prev,
                                students: [...prev.students, {
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: result.value.name,
                                  class: result.value.class
                                }]
                              }));
                              Swal.fire({ title: 'Đã thêm!', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
                            }
                          });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                      >
                        <Plus size={20} />
                        Thêm học sinh
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredStudents.map(student => {
                    const avg = data.grades.filter(g => g.studentId === student.id).reduce((a, b) => a + b.value, 0) / (data.grades.filter(g => g.studentId === student.id).length || 1);
                    const behaviorPoints = data.behaviors.filter(b => b.studentId === student.id).reduce((a, b) => a + b.points, 0);

                    return (
                      <div key={student.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            {isTeacher ? (
                              <label className="relative block w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 shadow-sm cursor-pointer group">
                                <img
                                  src={student.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=f8fafc`}
                                  alt={student.name}
                                  className="w-full h-full object-cover mix-blend-multiply transition-all group-hover:blur-[2px]"
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 text-white text-[10px] font-bold transition-opacity">
                                  Đổi ảnh
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleUpdateAvatar(student.id, e)}
                                />
                              </label>
                            ) : (
                              <div className="relative block w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                                <img
                                  src={student.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=f8fafc`}
                                  alt={student.name}
                                  className="w-full h-full object-cover mix-blend-multiply"
                                />
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{student.name}</h4>
                              <p className="text-slate-500 text-sm">Lớp {student.class}</p>
                            </div>
                          </div>
                          {isTeacher && (
                            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                              <MoreVertical size={20} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Điểm TB</p>
                            <p className="text-xl font-bold text-blue-900">{avg.toFixed(1)}</p>
                          </div>
                          <div className="bg-orange-50 p-3 rounded-xl">
                            <p className="text-xs text-orange-600 font-medium uppercase tracking-wider mb-1">Rèn luyện</p>
                            <p className="text-xl font-bold text-orange-900">{100 + behaviorPoints}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {isTeacher && (
                            <button
                              onClick={() => generateAIReport(student.id)}
                              className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                              <MessageSquare size={16} />
                              AI Report
                            </button>
                          )}
                          <button
                            onClick={() => setReportStudent(student)}
                            className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Tạo Phiếu Điểm"
                          >
                            <Printer size={20} />
                          </button>
                          {isTeacher && (
                            <button
                              onClick={() => {
                                setTargetStudentId(student.id);
                                setActiveTab('behavior');
                              }}
                              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                              Ghi nề nếp
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === 'behavior' && (
              <motion.div
                key="behavior"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">Ghi nhận nề nếp</h2>
                  <p className="text-slate-500">Ghi lại các hành vi tích cực hoặc vi phạm của học sinh theo thời gian thực</p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Học sinh</label>
                        <select
                          id="behavior-student"
                          value={targetStudentId}
                          onChange={(e) => setTargetStudentId(e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Chọn học sinh --</option>
                          {data.students.map(s => <option key={s.id} value={s.id}>{s.name} - {s.class}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Loại hành vi</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            id="type-positive"
                            className="p-4 rounded-2xl border-2 border-green-100 bg-green-50 text-green-700 flex flex-col items-center gap-2 hover:border-green-500 transition-all"
                            onClick={() => {
                              (document.getElementById('behavior-type') as HTMLInputElement).value = 'positive';
                              document.getElementById('type-positive')?.classList.add('border-green-500');
                              document.getElementById('type-negative')?.classList.remove('border-red-500');
                            }}
                          >
                            <CheckCircle2 size={32} />
                            <span className="font-bold">Tích cực</span>
                          </button>
                          <button
                            id="type-negative"
                            className="p-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-700 flex flex-col items-center gap-2 hover:border-red-500 transition-all"
                            onClick={() => {
                              (document.getElementById('behavior-type') as HTMLInputElement).value = 'negative';
                              document.getElementById('type-negative')?.classList.add('border-red-500');
                              document.getElementById('type-positive')?.classList.remove('border-green-500');
                            }}
                          >
                            <XCircle size={32} />
                            <span className="font-bold">Vi phạm</span>
                          </button>
                        </div>
                        <input type="hidden" id="behavior-type" defaultValue="positive" />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Danh mục</label>
                        <select id="behavior-category" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                          <option>Phát biểu xây dựng bài</option>
                          <option>Giúp đỡ bạn bè</option>
                          <option>Vệ sinh lớp học tốt</option>
                          <option>Đi học muộn</option>
                          <option>Không làm bài tập</option>
                          <option>Nói chuyện riêng</option>
                          <option>Sử dụng điện thoại</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Điểm (1-10)</label>
                        <input type="number" id="behavior-points" defaultValue="5" min="1" max="10" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Ghi chú thêm</label>
                        <textarea id="behavior-note" rows={3} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Chi tiết hành vi..."></textarea>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const studentId = (document.getElementById('behavior-student') as HTMLSelectElement).value;
                      const type = (document.getElementById('behavior-type') as HTMLInputElement).value as 'positive' | 'negative';
                      const category = (document.getElementById('behavior-category') as HTMLSelectElement).value;
                      const points = parseInt((document.getElementById('behavior-points') as HTMLInputElement).value);
                      const note = (document.getElementById('behavior-note') as HTMLTextAreaElement).value;
                      addBehavior(studentId, type, category, points, note);
                    }}
                    className="w-full mt-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Lưu ghi nhận
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                      <MessageSquare size={24} />
                    </div>
                    AI Tutor & Report Assistant
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {data.settings.selectedModel}
                  </div>
                </div>

                <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {isLoadingAI ? (
                      <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-500 animate-pulse">Gemini đang phân tích dữ liệu và soạn thảo báo cáo...</p>
                      </div>
                    ) : aiResponse ? (
                      <div className="relative">
                        <div className="flex justify-end mb-4 absolute right-0 -top-4">
                          <button
                            onClick={exportAIToWord}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl font-medium transition-colors shadow-sm"
                          >
                            <Download size={18} />
                            Xuất File Word
                          </button>
                        </div>
                        <div className="prose prose-slate max-w-none pt-8">
                          <div dangerouslySetInnerHTML={{ __html: marked.parse(aiResponse) as string }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <MessageSquare size={40} />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">Chưa có báo cáo nào</h4>
                          <p className="text-slate-500 max-w-xs">Hãy chọn một học sinh từ danh sách để AI tạo báo cáo đánh giá thông minh.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <input
                      type="text"
                      placeholder="Hỏi AI về tình hình lớp học..."
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          const prompt = e.currentTarget.value;
                          e.currentTarget.value = '';
                          setIsLoadingAI(true);
                          try {
                            const response = await callGeminiAI(prompt, data.settings.apiKey, data.settings.selectedModel);
                            setAiResponse(response);
                          } catch (err: any) {
                            Swal.fire('Lỗi', err.message, 'error');
                          } finally {
                            setIsLoadingAI(false);
                          }
                        }
                      }}
                    />
                    <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                      <TrendingUp size={24} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <h2 className="text-2xl font-bold">Cài đặt hệ thống</h2>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Key size={20} className="text-blue-600" />
                      Cấu hình Gemini AI
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">API Key</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={data.settings.apiKey}
                            onChange={(e) => setData(prev => ({ ...prev, settings: { ...prev.settings, apiKey: e.target.value } }))}
                            placeholder="Nhập API Key của bạn..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                          />
                          <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Lấy key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 hover:underline">Google AI Studio</a></p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Model ưu tiên</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {MODELS.map(m => (
                            <div
                              key={m.id}
                              onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, selectedModel: m.id } }))}
                              className={cn(
                                "p-4 border rounded-2xl cursor-pointer transition-all flex flex-col items-start gap-2",
                                data.settings.selectedModel === m.id
                                  ? "border-blue-500 bg-blue-50/50 shadow-md shadow-blue-100"
                                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              )}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={cn(
                                  "font-bold",
                                  data.settings.selectedModel === m.id ? "text-blue-700" : "text-slate-700"
                                )}>{m.name}</span>
                                {data.settings.selectedModel === m.id && (
                                  <CheckCircle2 size={18} className="text-blue-500" />
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded w-full truncate">
                                {m.id}
                              </span>
                              {m.id === 'gemini-3-flash-preview' && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase font-bold mt-1">Default</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 pt-8 border-t border-slate-100">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Lock size={20} className="text-blue-600" />
                      Mật khẩu Giáo viên
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Mật khẩu hiện tại</label>
                      <div className="relative">
                        <input
                          type="password"
                          value={data.settings.teacherPassword || '1234'}
                          onChange={(e) => setData(prev => ({ ...prev, settings: { ...prev.settings, teacherPassword: e.target.value } }))}
                          placeholder="Nhập mật khẩu mới..."
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                        />
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Mật khẩu này dùng để đăng nhập vai trò Giáo viên. Mặc định: 1234</p>
                    </div>
                  </section>

                  <section className="space-y-4 pt-8 border-t border-slate-100">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Save size={20} className="text-blue-600" />
                      Dữ liệu & Bảo mật
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `edumanage_backup_${dayjs().format('YYYYMMDD')}.json`;
                          a.click();
                        }}
                        className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-medium"
                      >
                        <Download size={20} />
                        Export JSON
                      </button>
                      <label className="flex items-center justify-center gap-2 p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-medium cursor-pointer">
                        <Upload size={20} />
                        Import JSON
                        <input
                          type="file"
                          className="hidden"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                try {
                                  const imported = JSON.parse(ev.target?.result as string);
                                  setData(imported);
                                  Swal.fire('Thành công', 'Đã khôi phục dữ liệu!', 'success');
                                } catch (err) {
                                  Swal.fire('Lỗi', 'File không hợp lệ', 'error');
                                }
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => {
                        Swal.fire({
                          title: 'Xóa toàn bộ dữ liệu?',
                          text: "Hành động này không thể hoàn tác!",
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonColor: '#ef4444',
                          confirmButtonText: 'Xóa ngay',
                          cancelButtonText: 'Hủy'
                        }).then((result) => {
                          if (result.isConfirmed) {
                            setData(INITIAL_DATA);
                            localStorage.removeItem('edumanage_data');
                            Swal.fire('Đã xóa!', 'Dữ liệu đã được reset.', 'success');
                          }
                        });
                      }}
                      className="w-full p-4 text-red-600 font-bold border border-red-100 rounded-2xl hover:bg-red-50 transition-all"
                    >
                      Reset ứng dụng
                    </button>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'grades' && (
              <motion.div
                key="grades"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Quản lý điểm số</h2>
                  {isTeacher && (
                    <div className="flex gap-3">
                      <button
                        onClick={downloadGradeTemplate}
                        className="flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors font-medium shadow-sm"
                        title="Tải file Excel mẫu nhập điểm"
                      >
                        <FileSpreadsheet size={18} />
                        Tải file mẫu
                      </button>
                      <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors cursor-pointer shadow-lg">
                        <Upload size={18} />
                        Nhập điểm nhanh
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          className="hidden"
                          onChange={importGradesFromExcel}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 font-bold text-slate-700">Học sinh</th>
                        {data.subjects.map(s => (
                          <th key={s.id} className="p-4 font-bold text-slate-700 text-center">{s.name}</th>
                        ))}
                        <th className="p-4 font-bold text-slate-700 text-center">Trung bình</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map(student => {
                        let total = 0;
                        let count = 0;
                        return (
                          <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <div className="font-medium">{student.name}</div>
                              <div className="text-xs text-slate-400">{student.class}</div>
                            </td>
                            {data.subjects.map(subject => {
                              const studentGrades = data.grades.filter(g => g.studentId === student.id && g.subjectId === subject.id);
                              const avg = studentGrades.length > 0
                                ? studentGrades.reduce((a, b) => a + b.value, 0) / studentGrades.length
                                : null;
                              if (avg !== null) {
                                total += avg;
                                count++;
                              }
                              return (
                                <td key={subject.id} className="p-4 text-center">
                                  {isTeacher ? (
                                    <button
                                      onClick={() => {
                                        Swal.fire({
                                          title: `Nhập điểm ${subject.name}`,
                                          text: `Học sinh: ${student.name}`,
                                          input: 'number',
                                          inputAttributes: { min: '0', max: '10', step: '0.1' },
                                          showCancelButton: true,
                                          confirmButtonText: 'Lưu',
                                          cancelButtonText: 'Hủy'
                                        }).then((result) => {
                                          if (result.isConfirmed && result.value) {
                                            addGrade(student.id, subject.id, 'regular', parseFloat(result.value));
                                          }
                                        });
                                      }}
                                      className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center mx-auto font-bold transition-all",
                                        avg === null ? "bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600" :
                                          avg >= 8 ? "bg-green-100 text-green-700" :
                                            avg >= 5 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                                      )}
                                    >
                                      {avg !== null ? avg.toFixed(1) : '+'}
                                    </button>
                                  ) : (
                                    <div
                                      className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center mx-auto font-bold",
                                        avg === null ? "bg-slate-100 text-slate-400" :
                                          avg >= 8 ? "bg-green-100 text-green-700" :
                                            avg >= 5 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                                      )}
                                    >
                                      {avg !== null ? avg.toFixed(1) : '-'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-4 text-center">
                              <div className="font-bold text-lg text-slate-900">
                                {count > 0 ? (total / count).toFixed(1) : '-'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold">Thống kê chi tiết</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Phân loại học lực</h3>
                    <div className="h-80">
                      <Bar
                        data={(() => {
                          let gioi = 0, kha = 0, tb = 0, yeu = 0;
                          data.students.forEach(s => {
                            const sg = data.grades.filter(g => g.studentId === s.id);
                            if (sg.length === 0) return;
                            const avg = sg.reduce((a, b) => a + b.value, 0) / sg.length;
                            if (avg >= 8) gioi++;
                            else if (avg >= 6.5) kha++;
                            else if (avg >= 5) tb++;
                            else yeu++;
                          });
                          return {
                            labels: ['Giỏi', 'Khá', 'Trung bình', 'Yếu'],
                            datasets: [{
                              label: 'Số lượng học sinh',
                              data: [gioi, kha, tb, yeu],
                              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                              borderRadius: 8
                            }]
                          };
                        })()}
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Điểm trung bình theo môn</h3>
                    <div className="h-80">
                      <Bar
                        data={{
                          labels: data.subjects.map(s => s.name),
                          datasets: [{
                            label: 'Điểm TB môn',
                            data: data.subjects.map(s => {
                              const grades = data.grades.filter(g => g.subjectId === s.id);
                              return grades.length > 0 ? (grades.reduce((a, b) => a + b.value, 0) / grades.length).toFixed(1) : 0;
                            }),
                            backgroundColor: '#6366f1',
                            borderRadius: 8
                          }]
                        }}
                        options={{
                          indexAxis: 'y' as const,
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: { x: { min: 0, max: 10 } }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6">Biến động nề nếp theo tháng</h3>
                  <div className="h-80">
                    <Line
                      data={(() => {
                        const months = ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'];
                        const monthNums = [9, 10, 11, 12, 1, 2];
                        const positiveByMonth = monthNums.map(m => data.behaviors.filter(b => b.type === 'positive' && new Date(b.date).getMonth() + 1 === m).length);
                        const negativeByMonth = monthNums.map(m => data.behaviors.filter(b => b.type === 'negative' && new Date(b.date).getMonth() + 1 === m).length);
                        return {
                          labels: months,
                          datasets: [
                            {
                              label: 'Tích cực',
                              data: positiveByMonth,
                              borderColor: '#10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              fill: true,
                              tension: 0.4
                            },
                            {
                              label: 'Vi phạm',
                              data: negativeByMonth,
                              borderColor: '#ef4444',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              fill: true,
                              tension: 0.4
                            }
                          ]
                        };
                      })()}
                      options={{ responsive: true, maintainAspectRatio: false }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'admission' && (() => {
              const admissionStudent = data.students.find(s => s.id === admissionStudentId) || data.students[0];
              const examDate = dayjs('2026-06-01');
              const daysLeft = examDate.diff(dayjs(), 'day');

              return (
                <motion.div
                  key="admission"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8"
              >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold flex items-center gap-3"><Target className="text-blue-600" /> Quản lý Tuyển sinh 10</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-medium">Kỳ thi dự kiến: 01/06/2026</span>
                <div className="px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center gap-2 shadow-sm border border-rose-200">
                  <Clock size={18} />
                  Còn {daysLeft > 0 ? daysLeft : 0} ngày
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Users size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-700 mb-1">Chọn học sinh để theo dõi</h3>
                <select
                  className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                  value={admissionStudent?.id || ''}
                  onChange={(e) => setAdmissionStudentId(e.target.value)}
                >
                  {data.students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.class}</option>
                  ))}
                </select>
              </div>
            </div>

                {admissionStudent && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Nguyện vọng */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="text-lg font-bold flex items-center gap-2"><Target className="text-orange-500" /> Nguyện vọng xét tuyển</h3>
                    </div>
                    <div className="p-6 flex-1 space-y-4">
                      {admissionStudent.targetSchools?.map((school: any, idx: number) => (
                        <div key={school.id} className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex justify-between items-center">
                          <div>
                            <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-1">Nguyện vọng {idx + 1}</p>
                            <h4 className="font-bold text-slate-800 text-lg">{school.name}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 mb-1">Điểm chuẩn dự kiến</p>
                            <p className="font-bold text-2xl text-orange-600">{school.targetScore}</p>
                          </div>
                        </div>
                      ))}
                      {(!admissionStudent.targetSchools || admissionStudent.targetSchools.length === 0) && (
                        <div className="p-8 text-center text-slate-400">
                          Chưa có nguyện vọng nào được đăng ký.
                        </div>
                      )}
                      {isTeacher && (
                        <button
                          onClick={() => {
                            Swal.fire({
                              title: 'Thêm Nguyện Vọng',
                              html: `
                                  <input id="swal-ts-name" class="swal2-input" placeholder="Tên trường THPT (VD: Nguyễn Thượng Hiền)">
                                  <input id="swal-ts-score" type="number" step="0.25" class="swal2-input" placeholder="Điểm chuẩn dự kiến">
                                `,
                              focusConfirm: false,
                              showCancelButton: true,
                              confirmButtonText: 'Lưu',
                              preConfirm: () => {
                                const name = (document.getElementById('swal-ts-name') as HTMLInputElement).value;
                                const score = parseFloat((document.getElementById('swal-ts-score') as HTMLInputElement).value);
                                if (!name || isNaN(score)) {
                                  Swal.showValidationMessage('Vui lòng nhập đầy đủ thông tin hợp lệ');
                                }
                                return { name, targetScore: score };
                              }
                            }).then((result) => {
                              if (result.isConfirmed) {
                                const newSchool = { id: Math.random().toString(), ...result.value };
                                setData((prev: any) => ({
                                  ...prev,
                                  students: prev.students.map((s: any) => s.id === admissionStudent.id ? {
                                    ...s,
                                    targetSchools: [...(s.targetSchools || []), newSchool]
                                  } : s)
                                }));
                              }
                            });
                          }}
                          className="w-full p-3 border-2 border-dashed border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2 mt-auto"
                        >
                          <Plus size={18} /> Thêm trường nguyện vọng
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Điểm thi thử */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-lg font-bold flex items-center gap-2"><BookOpen className="text-blue-500" /> Kết quả thi thử</h3>
                      {isTeacher && (
                        <button
                          onClick={() => {
                            Swal.fire({
                              title: 'Nhập điểm thi thử',
                              html: `
                                  <input id="swal-mock-date" type="text" class="swal2-input" placeholder="Tên/Ngày thi (VD: Lần 1 - 15/04)">
                                  <input id="swal-mock-math" type="number" step="0.25" class="swal2-input" placeholder="Điểm Toán">
                                  <input id="swal-mock-lit" type="number" step="0.25" class="swal2-input" placeholder="Điểm Ngữ Văn">
                                  <input id="swal-mock-eng" type="number" step="0.25" class="swal2-input" placeholder="Điểm Tiếng Anh">
                                  <input id="swal-mock-prio" type="number" step="0.25" class="swal2-input" placeholder="Điểm Ưu Tiên (Nếu có)">
                                `,
                              focusConfirm: false,
                              showCancelButton: true,
                              confirmButtonText: 'Lưu',
                              preConfirm: () => {
                                const date = (document.getElementById('swal-mock-date') as HTMLInputElement).value;
                                const math = parseFloat((document.getElementById('swal-mock-math') as HTMLInputElement).value);
                                const lit = parseFloat((document.getElementById('swal-mock-lit') as HTMLInputElement).value);
                                const eng = parseFloat((document.getElementById('swal-mock-eng') as HTMLInputElement).value);
                                const prio = parseFloat((document.getElementById('swal-mock-prio') as HTMLInputElement).value) || 0;
                                if (!date || isNaN(math) || isNaN(lit) || isNaN(eng)) {
                                  Swal.showValidationMessage('Vui lòng nhập đủ tên kì thi và điểm 3 môn');
                                }
                                return { date, math, literature: lit, english: eng, priority: prio };
                              }
                            }).then((result) => {
                              if (result.isConfirmed) {
                                const newMock = { id: Math.random().toString(), ...result.value };
                                setData((prev: any) => ({
                                  ...prev,
                                  students: prev.students.map((s: any) => s.id === admissionStudent.id ? {
                                    ...s,
                                    mockExams: [...(s.mockExams || []), newMock]
                                  } : s)
                                }));
                              }
                            });
                          }}
                          className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                        >+ Thêm điểm mới</button>
                      )}
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto max-h-[500px] space-y-4">
                      {admissionStudent.mockExams?.map((exam: any) => {
                        const totalBaseScore = exam.math + exam.literature + exam.english + (exam.priority || 0);
                        let statusColor = "bg-slate-100 text-slate-800";
                        let statusText = "Chưa xác định";

                        if (admissionStudent.targetSchools && admissionStudent.targetSchools.length > 0) {
                          const target = admissionStudent.targetSchools[0].targetScore;
                          const diff = totalBaseScore - target;
                          if (diff >= 1) {
                            statusColor = "bg-green-100 text-green-700 border-green-200";
                            statusText = "Phạm vi An Toàn";
                          } else if (diff >= -1) {
                            statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
                            statusText = "Cần cố gắng";
                          } else {
                            statusColor = "bg-red-100 text-red-700 border-red-200";
                            statusText = "Rủi ro cao";
                          }
                        }

                        return (
                          <div key={exam.id} className="p-5 border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                <Calendar size={16} className="text-blue-500" /> {exam.date}
                              </div>
                              <div className={cn("px-3 py-1 rounded-full text-xs font-bold border", statusColor)}>
                                {statusText}
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              <div className="bg-slate-50 p-2 rounded-lg text-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Toán</p>
                                <p className="font-bold text-slate-800">{exam.math}</p>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg text-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Ngữ Văn</p>
                                <p className="font-bold text-slate-800">{exam.literature}</p>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg text-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Anh</p>
                                <p className="font-bold text-slate-800">{exam.english}</p>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg text-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Ưu tiên</p>
                                <p className="font-bold text-slate-800">+{exam.priority || 0}</p>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                              <span className="text-sm text-slate-500 font-medium">Tổng điểm xét tuyển:</span>
                              <span className="text-2xl font-black text-blue-600">{totalBaseScore.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {(!admissionStudent.mockExams || admissionStudent.mockExams.length === 0) && (
                        <div className="p-8 text-center text-slate-400">
                          Chưa có điểm thi thử nào được ghi nhận.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Điểm chuẩn 2025 & Gợi ý trường học */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-8">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2"><Award className="text-purple-600" /> Điểm chuẩn năm 2025 & Gợi ý trường học</h3>
                      <p className="text-sm text-slate-500 mt-1">Dựa trên điểm trung bình: Toán, Ngữ Văn, Tiếng Anh từ mục Điểm số (Quy chuẩn hệ số 1)</p>
                    </div>
                    {isTeacher && (
                      <div className="flex gap-2">
                        <button
                          onClick={downloadAdmissionScoresTemplate}
                          className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2"
                        >
                          <FileSpreadsheet size={16} /> Mẫu Excel
                        </button>
                        <label className="text-sm font-medium text-white bg-slate-800 px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-2">
                          <Upload size={16} /> Tải điểm chuẩn (Excel)
                          <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={importAdmissionScoresFromExcel}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col lg:flex-row gap-8">
                    {/* Cột tính toán điểm và gợi ý */}
                    <div className="flex-1 space-y-6">
                      {(() => {
                        const mathGrades = data.grades.filter(g => g.studentId === admissionStudent.id && g.subjectId === 'math');
                        const litGrades = data.grades.filter(g => g.studentId === admissionStudent.id && g.subjectId === 'literature');
                        const engGrades = data.grades.filter(g => g.studentId === admissionStudent.id && g.subjectId === 'english');

                        const avgMath = mathGrades.length > 0 ? mathGrades.reduce((a, b) => a + b.value, 0) / mathGrades.length : 0;
                        const avgLit = litGrades.length > 0 ? litGrades.reduce((a, b) => a + b.value, 0) / litGrades.length : 0;
                        const avgEng = engGrades.length > 0 ? engGrades.reduce((a, b) => a + b.value, 0) / engGrades.length : 0;

                        const hasScore = mathGrades.length > 0 || litGrades.length > 0 || engGrades.length > 0;
                        const estimatedScore = avgMath + avgLit + avgEng;

                        return (
                          <>
                            <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
                              <h4 className="font-bold text-slate-700 mb-4 flex justify-between items-center">
                                <span>Điểm xét tuyển dự kiến</span>
                                <span className="text-xs font-normal text-slate-500">Toán + Văn + Anh</span>
                              </h4>
                              {hasScore ? (
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-4">
                                    <div className="text-center">
                                      <p className="text-xs text-slate-500 uppercase font-bold">Toán</p>
                                      <p className="font-bold text-lg">{avgMath.toFixed(1)}</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-slate-500 uppercase font-bold">Văn</p>
                                      <p className="font-bold text-lg">{avgLit.toFixed(1)}</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-slate-500 uppercase font-bold">Anh</p>
                                      <p className="font-bold text-lg">{avgEng.toFixed(1)}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-slate-500">Tổng quy đổi</p>
                                    <p className="text-3xl font-black text-purple-700">{estimatedScore.toFixed(2)}</p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-slate-500 text-sm">Học sinh chưa có điểm số nào ở các môn Toán, Ngữ văn, Tiếng Anh.</p>
                              )}
                            </div>

                            <div className="space-y-4">
                              <h4 className="font-bold text-slate-700 flex items-center gap-2">Trường phù hợp với trình độ</h4>
                              {hasScore && (data.admissionScores2025 || []).length > 0 ? (
                                <div className="space-y-3">
                                  {(data.admissionScores2025 || [])
                                    .filter(school => school.targetScore <= estimatedScore + 1.5)
                                    .sort((a, b) => b.targetScore - a.targetScore)
                                    .slice(0, 5)
                                    .map(school => {
                                      const diff = estimatedScore - school.targetScore;
                                      const safetyClass = diff >= 1.5 ? 'border-green-200 bg-green-50' : diff >= 0 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50';
                                      const safetyText = diff >= 1.5 ? 'Rất An toàn' : diff >= 0 ? 'Vừa sức' : 'Hơi với';

                                      return (
                                        <div key={`${school.name}-${school.targetScore}`} className={cn("p-4 border rounded-xl flex justify-between items-center", safetyClass)}>
                                          <div>
                                            <p className="font-bold text-slate-800">{school.name}</p>
                                            <p className="text-xs font-medium text-slate-600 mt-1">Trạng thái: {safetyText}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-bold text-lg text-slate-800">{school.targetScore}</p>
                                          </div>
                                        </div>
                                      );
                                    })
                                  }
                                </div>
                              ) : (
                                <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-500 border border-slate-100 italic">
                                  {!hasScore ? 'Cần cập nhật điểm số để có gợi ý.' : 'Chưa có dữ liệu điểm chuẩn. Vui lòng tải lên file Excel điểm chuẩn 2025.'}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Cột hiển thị toàn danh sách đã tải */}
                    <div className="flex-1 border-tl lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-8">
                      <h4 className="font-bold text-slate-700 mb-4 flex justify-between items-center">
                        <span>Bảng Điểm Chuẩn 2025</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          {(data.admissionScores2025 || []).length} trường
                        </span>
                      </h4>

                      {(data.admissionScores2025 || []).length > 0 ? (
                        <div className="max-h-[350px] overflow-y-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="p-3 font-bold text-slate-600">Trường THPT</th>
                                <th className="p-3 font-bold text-slate-600 font-mono text-right">Điểm</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(data.admissionScores2025 || [])
                                .slice()
                                .sort((a, b) => b.targetScore - a.targetScore)
                                .map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-700">{s.name}</td>
                                    <td className="p-3 font-bold text-slate-900 text-right">{s.targetScore}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-8">
                          <FileSpreadsheet size={48} className="mb-4 text-slate-300" />
                          <p>Hệ thống chưa có bảng điểm chuẩn quy chiếu.</p>
                          <p className="text-sm mt-2">Dữ liệu sẽ hiển thị tại đây sau khi bạn tải file Excel lên.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
          );
            })()}

          {activeTab === 'attendance' && <AttendanceTab data={data} setData={setData} userRole={userRole} />}
          {activeTab === 'funds' && <FundsTab data={data} setData={setData} userRole={userRole} />}
          {activeTab === 'tasks' && <TasksTab data={data} setData={setData} userRole={userRole} />}
          {activeTab === 'seating' && <SeatingTab data={data} setData={setData} userRole={userRole} />}

        </AnimatePresence>
    </div>
      </main >

    <ParentReportModal student={reportStudent} data={data} onClose={() => setReportStudent(null)} />

  {/* API Key Modal */ }
  <AnimatePresence>
    {showApiModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full"
        >
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex justify-between items-start">
            <div className="text-white">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Key size={24} />
                Cấu hình API Key
              </h3>
              <p className="text-blue-100 text-sm mt-1">EduManage cần Gemini API Key để hoạt động</p>
            </div>
            {data.settings.apiKey && (
              <button onClick={() => setShowApiModal(false)} className="text-white/70 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            )}
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nhập API Key của bạn</label>
              <input
                type="password"
                value={data.settings.apiKey}
                onChange={(e) => setData(prev => ({ ...prev, settings: { ...prev.settings, apiKey: e.target.value } }))}
                placeholder="AIzaSy..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex gap-3 text-sm text-orange-800">
              <AlertCircle size={20} className="shrink-0 text-orange-500" />
              <div>
                <p className="font-bold mb-1">Bạn chưa có API Key?</p>
                <p>Hãy truy cập <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">Google AI Studio</a> để lấy key miễn phí nhé.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (!data.settings.apiKey) {
                    Swal.fire('Lỗi', 'Vui lòng nhập API Key', 'error');
                    return;
                  }
                  setShowApiModal(false);
                  Swal.fire({ title: 'Đã lưu!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                }}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
    </div >
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: { title: string, value: string | number, icon: any, color: 'blue' | 'green' | 'orange' | 'purple', trend: string }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600"
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-xl", colors[color])}>
          <Icon size={24} />
        </div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{trend}</span>
      </div>
      <h4 className="text-slate-500 text-sm font-medium">{title}</h4>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
