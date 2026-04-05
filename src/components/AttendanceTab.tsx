import React, { useState, useMemo } from 'react';
import { CalendarCheck, CheckCircle2, XCircle, Clock, Users, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import { AppData, AttendanceRecord } from '../types';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}

export default function AttendanceTab({ data, setData }: Props) {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedClass, setSelectedClass] = useState('All');

  const classes = useMemo(() => ['All', ...Array.from(new Set(data.students.map(s => s.class)))], [data.students]);

  const filteredStudents = useMemo(() => {
    return data.students.filter(s => selectedClass === 'All' || s.class === selectedClass);
  }, [data.students, selectedClass]);

  const attendanceForDate = useMemo(() => {
    return data.attendance.filter(a => a.date === selectedDate);
  }, [data.attendance, selectedDate]);

  const getStatus = (studentId: string): AttendanceRecord | undefined => {
    return attendanceForDate.find(a => a.studentId === studentId);
  };

  const markAttendance = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setData(prev => {
      const existing = prev.attendance.find(a => a.studentId === studentId && a.date === selectedDate);
      if (existing) {
        return {
          ...prev,
          attendance: prev.attendance.map(a =>
            a.id === existing.id ? { ...a, status } : a
          ),
        };
      }
      return {
        ...prev,
        attendance: [
          ...prev.attendance,
          {
            id: Math.random().toString(36).substr(2, 9),
            studentId,
            date: selectedDate,
            status,
          },
        ],
      };
    });
  };

  const markAllPresent = () => {
    setData(prev => {
      const studentsToMark = filteredStudents.filter(s => !attendanceForDate.find(a => a.studentId === s.id));
      const newRecords: AttendanceRecord[] = studentsToMark.map(s => ({
        id: Math.random().toString(36).substr(2, 9),
        studentId: s.id,
        date: selectedDate,
        status: 'present' as const,
      }));
      return { ...prev, attendance: [...prev.attendance, ...newRecords] };
    });
    Swal.fire({ title: 'Đã điểm danh!', text: 'Tất cả học sinh được đánh dấu có mặt.', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
  };

  const stats = useMemo(() => {
    const present = attendanceForDate.filter(a => a.status === 'present').length;
    const absent = attendanceForDate.filter(a => a.status === 'absent').length;
    const late = attendanceForDate.filter(a => a.status === 'late').length;
    return { present, absent, late, total: filteredStudents.length };
  }, [attendanceForDate, filteredStudents]);

  const statusConfig = {
    present: { label: 'Có mặt', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200', btnColor: 'bg-green-100 hover:bg-green-200 text-green-700' },
    absent: { label: 'Vắng', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200', btnColor: 'bg-red-100 hover:bg-red-200 text-red-700' },
    late: { label: 'Muộn', icon: Clock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', btnColor: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700' },
  };

  return (
    <motion.div
      key="attendance"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <CalendarCheck className="text-blue-600" /> Điểm danh
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map(c => <option key={c} value={c}>{c === 'All' ? 'Tất cả lớp' : c}</option>)}
          </select>
          <button
            onClick={markAllPresent}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 font-medium"
          >
            <CheckCircle2 size={18} /> Điểm danh tất cả
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-sm text-slate-500 font-medium">Tổng</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm text-center">
          <p className="text-sm text-green-600 font-medium">Có mặt</p>
          <p className="text-2xl font-bold text-green-700">{stats.present}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm text-center">
          <p className="text-sm text-red-600 font-medium">Vắng</p>
          <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 shadow-sm text-center">
          <p className="text-sm text-yellow-600 font-medium">Muộn</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.late}</p>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-bold text-slate-700">Học sinh</th>
              <th className="p-4 font-bold text-slate-700">Lớp</th>
              <th className="p-4 font-bold text-slate-700 text-center">Trạng thái</th>
              <th className="p-4 font-bold text-slate-700 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.map(student => {
              const record = getStatus(student.id);
              const status = record?.status;
              return (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium">{student.name}</td>
                  <td className="p-4 text-slate-500">{student.class}</td>
                  <td className="p-4 text-center">
                    {status ? (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${statusConfig[status].color}`}>
                        {React.createElement(statusConfig[status].icon, { size: 14 })}
                        {statusConfig[status].label}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">Chưa điểm danh</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {(['present', 'absent', 'late'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => markAttendance(student.id, s)}
                          className={`p-2 rounded-lg transition-all text-sm font-medium ${status === s ? statusConfig[s].btnColor + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          title={statusConfig[s].label}
                        >
                          {React.createElement(statusConfig[s].icon, { size: 16 })}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredStudents.length === 0 && (
          <div className="p-12 text-center text-slate-400">Chưa có học sinh nào.</div>
        )}
      </div>
    </motion.div>
  );
}
