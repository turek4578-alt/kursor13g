'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

export default function SupportPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('Заявка не исполнена');
  const [message, setMessage] = useState('');

  async function send() {
    if (!message.trim()) { toast('Напишите сообщение'); return; }
    // No dedicated tickets API yet in this build — this is a placeholder
    // that just confirms receipt; wire to /api/tickets when that route exists.
    toast('Обращение отправлено');
    setMessage('');
  }

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => router.push('/app/profile')}>‹</button>
        <div className="title">Поддержка</div>
      </div>
      <div className="page">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Новое обращение</h3>
          <label className="f">
            <span>Тема</span>
            <select className="in" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option>Заявка не исполнена</option>
              <option>Вопрос по верификации</option>
              <option>Не вижу пополнение</option>
              <option>Другое</option>
            </select>
          </label>
          <label className="f">
            <span>Сообщение</span>
            <textarea className="in" rows={4} placeholder="Опишите ситуацию. Номер заявки — если есть." value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <button className="btn" onClick={send}>Отправить</button>
        </div>
        <div className="card row">
          <div>
            <h3>Telegram</h3>
            <div className="small muted">@kurs_support · ответ 1–3 часа</div>
          </div>
          <button className="btn sm ghost" onClick={() => toast('Открывается Telegram')}>Открыть</button>
        </div>
      </div>
    </>
  );
}
