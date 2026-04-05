import React, { useState, useMemo } from 'react';
import { Presentation, Shuffle, RotateCcw, Save } from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';
import { AppData, Student } from '../types';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}

const ROWS = 6;
const COLS = 8;

export default function SeatingTab({ data, setData }: Props) {
  const [selectedClass, setSelectedClass] = useState('All');
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);

  const classes = useMemo(() => ['All', ...Array.from(new Set(data.students.map(s => s.class)))], [data.students]);

  const students = useMemo(() => {
    return data.students.filter(s => selectedClass === 'All' || s.class === selectedClass);
  }, [data.students, selectedClass]);

  const seatedStudents = useMemo(() => {
    return students.filter(s => s.seatingRow !== undefined && s.seatingCol !== undefined);
  }, [students]);

  const unseatedStudents = useMemo(() => {
    return students.filter(s => s.seatingRow === undefined || s.seatingCol === undefined);
  }, [students]);

  const getStudentAt = (row: number, col: number): Student | undefined => {
    return students.find(s => s.seatingRow === row && s.seatingCol === col);
  };

  const assignSeat = (studentId: string, row: number, col: number) => {
    setData(prev => ({
      ...prev,
      students: prev.students.map(s =>
        s.id === studentId ? { ...s, seatingRow: row, seatingCol: col } : s
      ),
    }));
  };

  const removeSeat = (studentId: string) => {
    setData(prev => ({
      ...prev,
      students: prev.students.map(s =>
        s.id === studentId ? { ...s, seatingRow: undefined, seatingCol: undefined } : s
      ),
    }));
  };

  const shuffleSeats = () => {
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const maxSeats = ROWS * COLS;
    
    setData(prev => ({
      ...prev,
      students: prev.students.map(s => {
        const idx = shuffled.findIndex(sh => sh.id === s.id);
        if (idx === -1 || idx >= maxSeats) return { ...s, seatingRow: undefined, seatingCol: undefined };
        const row = Math.floor(idx / COLS);
        const col = idx % COLS;
        return { ...s, seatingRow: row, seatingCol: col };
      }),
    }));

    Swal.fire({ title: 'Đã xáo trộn!', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
  };

  const resetSeats = () => {
    Swal.fire({
      title: 'Xóa sơ đồ lớp?',
      text: 'Tất cả vị trí ngồi sẽ bị gỡ bỏ.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    }).then(result => {
      if (result.isConfirmed) {
        setData(prev => ({
          ...prev,
          students: prev.students.map(s => {
            if (selectedClass === 'All' || s.class === selectedClass) {
              return { ...s, seatingRow: undefined, seatingCol: undefined };
            }
            return s;
          }),
        }));
      }
    });
  };

  const handleDragStart = (student: Student) => {
    setDraggedStudent(student);
  };

  const handleDrop = (row: number, col: number) => {
    if (!draggedStudent) return;
    const existingStudent = getStudentAt(row, col);
    if (existingStudent && existingStudent.id !== draggedStudent.id) {
      // Swap seats
      const oldRow = draggedStudent.seatingRow;
      const oldCol = draggedStudent.seatingCol;
      setData(prev => ({
        ...prev,
        students: prev.students.map(s => {
          if (s.id === draggedStudent.id) return { ...s, seatingRow: row, seatingCol: col };
          if (s.id === existingStudent.id) return { ...s, seatingRow: oldRow, seatingCol: oldCol };
          return s;
        }),
      }));
    } else {
      assignSeat(draggedStudent.id, row, col);
    }
    setDraggedStudent(null);
  };

  return (
    <motion.div key="seating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Presentation className="text-blue-600" /> Sơ đồ lớp học
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map(c => <option key={c} value={c}>{c === 'All' ? 'Tất cả lớp' : c}</option>)}
          </select>
          <button onClick={shuffleSeats} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium shadow-lg shadow-purple-200">
            <Shuffle size={18} /> Xáo trộn
          </button>
          <button onClick={resetSeats} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-medium">
            <RotateCcw size={18} /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Seating grid */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Teacher desk */}
          <div className="mb-6 flex justify-center">
            <div className="bg-slate-800 text-white px-12 py-3 rounded-xl font-bold text-center shadow-lg">
              BẢNG
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
            {Array.from({ length: ROWS * COLS }).map((_, idx) => {
              const row = Math.floor(idx / COLS);
              const col = idx % COLS;
              const student = getStudentAt(row, col);

              return (
                <div
                  key={idx}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(row, col)}
                  className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-center p-1 transition-all cursor-pointer ${
                    student
                      ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                  }`}
                >
                  {student ? (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(student)}
                      onDoubleClick={() => removeSeat(student.id)}
                      className="text-[10px] font-bold text-blue-800 leading-tight cursor-grab active:cursor-grabbing select-none"
                      title={`${student.name} - Double click để gỡ`}
                    >
                      {student.name.split(' ').slice(-2).join(' ')}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-[9px]">{row + 1}-{col + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unseated students */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-700 mb-4">Chưa xếp ({unseatedStudents.length})</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {unseatedStudents.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Tất cả đã được xếp chỗ!</p>
            ) : (
              unseatedStudents.map(student => (
                <div
                  key={student.id}
                  draggable
                  onDragStart={() => handleDragStart(student)}
                  className="bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-grab active:cursor-grabbing hover:bg-blue-50 hover:border-blue-200 transition-all"
                >
                  <p className="font-medium text-sm text-slate-800">{student.name}</p>
                  <p className="text-xs text-slate-400">{student.class}</p>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-slate-400 mt-4 italic">Kéo thả HS vào ô trên bản đồ. Double-click để gỡ.</p>
        </div>
      </div>
    </motion.div>
  );
}
