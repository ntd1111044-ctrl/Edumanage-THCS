export interface TargetHighSchool {
  id: string;
  name: string;
  targetScore: number;
}

export interface MockExam {
  id: string;
  date: string;
  math: number;
  literature: number;
  english: number;
  special?: number; // Điểm chuyên (nếu có)
  priority?: number; // Điểm ưu tiên (nếu có)
}

export interface FundTransaction {
  id: string;
  type: 'in' | 'out';
  amount: number;
  date: string;
  description: string;
  studentId?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  note?: string;
}

export interface HomeworkTask {
  id: string;
  title: string;
  dueDate: string;
  description?: string;
}

export interface HomeworkSubmission {
  id: string;
  taskId: string;
  studentId: string;
  status: 'done' | 'missing' | 'late';
}

export interface Student {
  id: string;
  name: string;
  class: string;
  avatar?: string;
  targetSchools?: TargetHighSchool[];
  mockExams?: MockExam[];
  seatingRow?: number;
  seatingCol?: number;
}

export interface BehaviorRecord {
  id: string;
  studentId: string;
  type: 'positive' | 'negative';
  category: string;
  points: number;
  note: string;
  date: string;
  subjectId: string;
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  type: 'regular' | 'midterm' | 'final';
  value: number;
  date: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
}

export interface AdmissionScore {
  id: string;
  name: string;
  targetScore: number;
}

export interface AppData {
  students: Student[];
  subjects: Subject[];
  grades: Grade[];
  behaviors: BehaviorRecord[];
  funds: FundTransaction[];
  attendance: AttendanceRecord[];
  tasks: HomeworkTask[];
  submissions: HomeworkSubmission[];
  admissionScores2025: AdmissionScore[];
  settings: {
    theme: 'light' | 'dark';
    apiKey: string;
    selectedModel: string;
    teacherPassword: string;
  };
}

export const INITIAL_DATA: AppData = {
  students: [
    { id: '1', name: 'Nguyễn Văn A', class: '9A1' },
    { id: '2', name: 'Trần Thị B', class: '9A1' },
    { id: '3', name: 'Lê Văn C', class: '9A1' },
    { id: '4', name: 'Phạm Thị D', class: '9A2' },
    { id: '5', name: 'Hoàng Văn E', class: '9A2' },
  ],
  subjects: [
    { id: 'math', name: 'Toán học', icon: 'Calculator' },
    { id: 'literature', name: 'Ngữ văn', icon: 'BookOpen' },
    { id: 'english', name: 'Tiếng Anh', icon: 'Languages' },
    { id: 'physics', name: 'Vật lý', icon: 'Zap' },
    { id: 'chemistry', name: 'Hóa học', icon: 'FlaskConical' },
  ],
  grades: [],
  behaviors: [],
  funds: [],
  attendance: [],
  tasks: [],
  submissions: [],
  admissionScores2025: [],
  settings: {
    theme: 'light',
    apiKey: '',
    selectedModel: 'gemini-3-flash-preview',
    teacherPassword: '1234',
  },
};
