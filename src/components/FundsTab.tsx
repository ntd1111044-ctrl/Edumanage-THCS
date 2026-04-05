import React, { useState, useMemo } from 'react';
import { Wallet, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import { AppData, FundTransaction } from '../types';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}

export default function FundsTab({ data, setData }: Props) {
  const totalIn = useMemo(() => data.funds.filter(f => f.type === 'in').reduce((a, b) => a + b.amount, 0), [data.funds]);
  const totalOut = useMemo(() => data.funds.filter(f => f.type === 'out').reduce((a, b) => a + b.amount, 0), [data.funds]);
  const balance = totalIn - totalOut;

  const addTransaction = (type: 'in' | 'out') => {
    Swal.fire({
      title: type === 'in' ? 'Thu tiền' : 'Chi tiền',
      html: `
        <input id="swal-fund-amount" type="number" class="swal2-input" placeholder="Số tiền (VNĐ)">
        <input id="swal-fund-desc" class="swal2-input" placeholder="Mô tả (VD: Thu quỹ tháng 4)">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Lưu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: type === 'in' ? '#10b981' : '#ef4444',
      preConfirm: () => {
        const amount = parseFloat((document.getElementById('swal-fund-amount') as HTMLInputElement).value);
        const description = (document.getElementById('swal-fund-desc') as HTMLInputElement).value;
        if (isNaN(amount) || amount <= 0 || !description) {
          Swal.showValidationMessage('Vui lòng nhập đầy đủ thông tin hợp lệ');
          return;
        }
        return { amount, description };
      }
    }).then(result => {
      if (result.isConfirmed && result.value) {
        const newTx: FundTransaction = {
          id: Math.random().toString(36).substr(2, 9),
          type,
          amount: result.value.amount,
          description: result.value.description,
          date: new Date().toISOString(),
        };
        setData(prev => ({ ...prev, funds: [newTx, ...prev.funds] }));
        Swal.fire({ title: 'Đã lưu!', icon: 'success', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
      }
    });
  };

  const deleteTransaction = (id: string) => {
    Swal.fire({
      title: 'Xóa giao dịch?',
      text: 'Hành động này không thể hoàn tác!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    }).then(result => {
      if (result.isConfirmed) {
        setData(prev => ({ ...prev, funds: prev.funds.filter(f => f.id !== id) }));
      }
    });
  };

  const formatMoney = (v: number) => v.toLocaleString('vi-VN') + ' ₫';

  return (
    <motion.div key="funds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Wallet className="text-blue-600" /> Quỹ lớp
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => addTransaction('in')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 font-medium"
          >
            <ArrowDownRight size={18} /> Thu tiền
          </button>
          <button
            onClick={() => addTransaction('out')}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 font-medium"
          >
            <ArrowUpRight size={18} /> Chi tiền
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-green-50 p-6 rounded-2xl border border-green-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-green-600" />
            <p className="text-sm text-green-600 font-bold uppercase tracking-wider">Tổng thu</p>
          </div>
          <p className="text-2xl font-bold text-green-800">{formatMoney(totalIn)}</p>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={20} className="text-red-600" />
            <p className="text-sm text-red-600 font-bold uppercase tracking-wider">Tổng chi</p>
          </div>
          <p className="text-2xl font-bold text-red-800">{formatMoney(totalOut)}</p>
        </div>
        <div className={`p-6 rounded-2xl border shadow-sm ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={20} className={balance >= 0 ? 'text-blue-600' : 'text-orange-600'} />
            <p className={`text-sm font-bold uppercase tracking-wider ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Số dư</p>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>{formatMoney(balance)}</p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold">Lịch sử giao dịch</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {data.funds.length === 0 ? (
            <div className="p-12 text-center text-slate-400">Chưa có giao dịch nào.</div>
          ) : (
            data.funds.map(tx => (
              <div key={tx.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'in' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {tx.type === 'in' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{tx.description}</p>
                  <p className="text-sm text-slate-400">{dayjs(tx.date).format('DD/MM/YYYY HH:mm')}</p>
                </div>
                <div className={`font-bold text-lg ${tx.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'in' ? '+' : '-'}{formatMoney(tx.amount)}
                </div>
                <button onClick={() => deleteTransaction(tx.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
