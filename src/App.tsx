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
  Trash2,
  Save
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
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Marked } from 'marked';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

import { cn } from './lib/utils';
import { Student, Subject, Grade, BehaviorRecord, AppData, INITIAL_DATA } from './types';
import { callGeminiAI, MODELS } from './lib/gemini';

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
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'grades' | 'behavior' | 'stats' | 'ai' | 'settings'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState<string>('');

  // Show modal if no API key is provided
  useEffect(() => {
    if (!data.settings.apiKey) {
      setShowApiModal(true);
    }
  }, []);

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

  const exportAIToWord = async () => {
    if (!aiResponse) return;

    try {
      // Create document
      const doc = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 24 } } },
          paragraphStyles: [
            { id: "Normal", name: "Normal", run: { font: "Arial", size: 24 } },
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
              run: { size: 32, bold: true, color: "000000" },
              paragraph: { spacing: { before: 240, after: 120 } } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
              run: { size: 28, bold: true, color: "000000" },
              paragraph: { spacing: { before: 240, after: 120 } } },
            { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal",
              run: { size: 24, bold: true, color: "000000" },
              paragraph: { spacing: { before: 240, after: 120 } } },
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

  const SidebarItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
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
          <SidebarItem id="behavior" icon={ShieldCheck} label="Nề nếp" />
          <SidebarItem id="stats" icon={BarChart3} label="Thống kê" />
          <SidebarItem id="ai" icon={MessageSquare} label="AI Tutor" />
        </nav>

        <div className="p-3 border-t border-slate-100">
          <SidebarItem id="settings" icon={Settings} label="Cài đặt" />
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
            <button onClick={exportToExcel} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
              <Download size={20} />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">
              GV
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
                        data={{
                          labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5', 'Tuần 6'],
                          datasets: [{
                            label: 'Điểm trung bình',
                            data: [7.2, 7.5, 7.3, 7.8, 8.1, 8.0],
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            fill: true,
                            tension: 0.4
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6">Phân bổ hạnh kiểm</h3>
                    <div className="h-80 flex items-center justify-center">
                      <Doughnut 
                        data={{
                          labels: ['Tốt', 'Khá', 'Trung bình', 'Yếu'],
                          datasets: [{
                            data: [65, 20, 10, 5],
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                            borderWidth: 0
                          }]
                        }}
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
                  <div className="flex gap-3">
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
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                      <Plus size={20} />
                      Thêm học sinh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredStudents.map(student => {
                    const avg = data.grades.filter(g => g.studentId === student.id).reduce((a, b) => a + b.value, 0) / (data.grades.filter(g => g.studentId === student.id).length || 1);
                    const behaviorPoints = data.behaviors.filter(b => b.studentId === student.id).reduce((a, b) => a + b.points, 0);
                    
                    return (
                      <div key={student.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
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
                            <div>
                              <h4 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{student.name}</h4>
                              <p className="text-slate-500 text-sm">Lớp {student.class}</p>
                            </div>
                          </div>
                          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                            <MoreVertical size={20} />
                          </button>
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
                          <button 
                            onClick={() => generateAIReport(student.id)}
                            className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                          >
                            <MessageSquare size={16} />
                            AI Report
                          </button>
                          <button 
                            onClick={() => {
                              setTargetStudentId(student.id);
                              setActiveTab('behavior');
                            }}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                          >
                            Ghi nề nếp
                          </button>
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
                  <div className="flex gap-3">
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
                        data={{
                          labels: ['Giỏi', 'Khá', 'Trung bình', 'Yếu'],
                          datasets: [{
                            label: 'Số lượng học sinh',
                            data: [12, 25, 8, 2],
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                            borderRadius: 8
                          }]
                        }}
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
                      data={{
                        labels: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2'],
                        datasets: [
                          {
                            label: 'Tích cực',
                            data: [45, 52, 48, 60, 55, 68],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                          },
                          {
                            label: 'Vi phạm',
                            data: [15, 12, 18, 10, 8, 5],
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4
                          }
                        ]
                      }}
                      options={{ responsive: true, maintainAspectRatio: false }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* API Key Modal */}
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
    </div>
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
