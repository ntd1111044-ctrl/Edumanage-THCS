import React, { useState, useMemo } from 'react';
import { CheckSquare, Plus, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import { AppData, HomeworkTask, HomeworkSubmission } from '../types';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  userRole: 'teacher' | 'student';
}

export default function TasksTab({ data, setData, userRole }: Props) {
  const isTeacher = userRole === 'teacher';
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  const addTask = () => {
    Swal.fire({
      title: 'Tạo bài tập mới',
      html: `
        <input id="swal-task-title" class="swal2-input" placeholder="Tên bài tập (VD: Bài tập Toán chương 5)">
        <input id="swal-task-due" type="date" class="swal2-input" value="${dayjs().add(3, 'day').format('YYYY-MM-DD')}">
        <textarea id="swal-task-desc" class="swal2-textarea" placeholder="Mô tả chi tiết (không bắt buộc)"></textarea>
      `,
      confirmButtonText: 'Tạo',
      showCancelButton: true,
      cancelButtonText: 'Hủy',
      preConfirm: () => {
        const title = (document.getElementById('swal-task-title') as HTMLInputElement).value;
        const dueDate = (document.getElementById('swal-task-due') as HTMLInputElement).value;
        const description = (document.getElementById('swal-task-desc') as HTMLTextAreaElement).value;
        if (!title || !dueDate) {
          Swal.showValidationMessage('Vui lòng nhập tên và hạn nộp');
          return;
        }
        return { title, dueDate, description };
      }
    }).then(result => {
      if (result.isConfirmed && result.value) {
        const newTask: HomeworkTask = {
          id: Math.random().toString(36).substr(2, 9),
          title: result.value.title,
          dueDate: result.value.dueDate,
          description: result.value.description || undefined,
        };
        setData(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
        Swal.fire({ title: 'Đã tạo!', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
      }
    });
  };

  const markSubmission = (taskId: string, studentId: string, status: HomeworkSubmission['status']) => {
    setData(prev => {
      const existing = prev.submissions.find(s => s.taskId === taskId && s.studentId === studentId);
      if (existing) {
        return {
          ...prev,
          submissions: prev.submissions.map(s =>
            s.id === existing.id ? { ...s, status } : s
          ),
        };
      }
      return {
        ...prev,
        submissions: [
          ...prev.submissions,
          {
            id: Math.random().toString(36).substr(2, 9),
            taskId,
            studentId,
            status,
          },
        ],
      };
    });
  };

  const deleteTask = (taskId: string) => {
    Swal.fire({
      title: 'Xóa bài tập?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    }).then(result => {
      if (result.isConfirmed) {
        setData(prev => ({
          ...prev,
          tasks: prev.tasks.filter(t => t.id !== taskId),
          submissions: prev.submissions.filter(s => s.taskId !== taskId),
        }));
      }
    });
  };

  const selectedTask = data.tasks.find(t => t.id === selectedTaskId);

  const getSubmissionStatus = (taskId: string, studentId: string): HomeworkSubmission['status'] | null => {
    return data.submissions.find(s => s.taskId === taskId && s.studentId === studentId)?.status || null;
  };

  const statusConfig = {
    done: { label: 'Đã nộp', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
    missing: { label: 'Thiếu', icon: XCircle, color: 'bg-red-100 text-red-700' },
    late: { label: 'Muộn', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  };

  return (
    <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <CheckSquare className="text-blue-600" /> Quản lý bài tập
        </h2>
        {isTeacher && (
          <button
            onClick={addTask}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 font-medium"
          >
            <Plus size={18} /> Tạo bài tập
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task list */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700">Danh sách bài tập ({data.tasks.length})</h3>
          {data.tasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
              Chưa có bài tập nào. Nhấn "Tạo bài tập" để bắt đầu.
            </div>
          ) : (
            data.tasks.map(task => {
              const doneCount = data.submissions.filter(s => s.taskId === task.id && s.status === 'done').length;
              const isOverdue = dayjs(task.dueDate).isBefore(dayjs(), 'day');
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`bg-white p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:shadow-md ${selectedTaskId === task.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800">{task.title}</h4>
                    {isTeacher && (
                      <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                  {task.description && <p className="text-sm text-slate-500 mb-2">{task.description}</p>}
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isOverdue ? 'Quá hạn' : `Hạn: ${dayjs(task.dueDate).format('DD/MM/YYYY')}`}
                    </span>
                    <span className="text-xs text-slate-500">{doneCount}/{data.students.length} đã nộp</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Submission tracking */}
        <div className="lg:col-span-2">
          {selectedTask ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold">{selectedTask.title}</h3>
                <p className="text-sm text-slate-500">Hạn nộp: {dayjs(selectedTask.dueDate).format('DD/MM/YYYY')}</p>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-700">Học sinh</th>
                    <th className="p-4 font-bold text-slate-700">Lớp</th>
                    <th className="p-4 font-bold text-slate-700 text-center">Trạng thái</th>
                    {isTeacher && <th className="p-4 font-bold text-slate-700 text-center">Hành động</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map(student => {
                    const status = getSubmissionStatus(selectedTask.id, student.id);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="p-4 font-medium">{student.name}</td>
                        <td className="p-4 text-slate-500">{student.class}</td>
                        <td className="p-4 text-center">
                          {status ? (
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusConfig[status].color}`}>
                              {React.createElement(statusConfig[status].icon, { size: 12 })}
                              {statusConfig[status].label}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </td>
                        {isTeacher && (
                          <td className="p-4">
                            <div className="flex justify-center gap-1">
                              {(['done', 'late', 'missing'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => markSubmission(selectedTask.id, student.id, s)}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${status === s ? statusConfig[s].color + ' ring-1 ring-current' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                  {statusConfig[s].label}
                                </button>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-12 text-slate-400 h-full min-h-[400px]">
              <CheckSquare size={48} className="mb-4 text-slate-300" />
              <p className="font-medium">Chọn một bài tập bên trái để theo dõi tình hình nộp bài</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
