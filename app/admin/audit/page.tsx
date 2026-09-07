'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';

export default function AdminAuditPage() {
  const [log, setLog] = useState<any[]>([]);
  useEffect(() => {
    api('/api/admin/audit').then((d) => setLog(d.log));
  }, []);

  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Audit log</h1>
      <div className="small muted" style={{ marginBottom: 16 }}>Неизменяемый журнал действий персонала</div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead>
          <tbody>
            {log.map((a) => (
              <tr key={a.id}>
                <td className="mono small">{dt(a.created_at)}</td>
                <td className="small">{a.admin_email}</td>
                <td className="mono small">{a.action}</td>
                <td className="small">{a.entity}</td>
                <td className="small">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
