export interface Student {
  id: string;
  name: string;
  class: string;
  avatar?: string;
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

export interface AppData {
  students: Student[];
  subjects: Subject[];
  grades: Grade[];
  behaviors: BehaviorRecord[];
  settings: {
    theme: 'light' | 'dark';
    apiKey: string;
    selectedModel: string;
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
  settings: {
    theme: 'light',
    apiKey: '',
    selectedModel: 'gemini-3-flash-preview',
  },
};
