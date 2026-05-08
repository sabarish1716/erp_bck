type AttendancePoint = {
  label: string;
  present: number;
};

type LeaveRow = {
  id: string;
  staffName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
};

type Props = {
  attendanceSeries: AttendancePoint[];
  pendingLeaves: LeaveRow[];
};

export function InsightsPanels({ attendanceSeries, pendingLeaves }: Props) {
  const maxPresent = Math.max(1, ...attendanceSeries.map((x) => x.present));

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <article className="rounded-xl border border-line/50 bg-panel p-4 shadow xl:col-span-2">
        <h4 className="text-lg font-extrabold text-primary">Attendance Trend (Daily)</h4>
        <p className="mb-4 mt-1 text-xs text-slate-600">Present count inferred from monthly attendance records.</p>

        <div className="flex h-64 items-end gap-2 rounded-lg border border-line/40 bg-slate-50 px-3 pb-3 pt-6">
          {attendanceSeries.length === 0 ? (
            <p className="m-auto text-sm text-slate-500">No attendance data available for this month.</p>
          ) : (
            attendanceSeries.map((point) => {
              const height = Math.max(8, Math.round((point.present / maxPresent) * 180));
              return (
                <div key={point.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div className="text-[10px] font-bold text-primary">{point.present}</div>
                  <div className="w-full rounded-t-md bg-primary" style={{ height }} />
                  <div className="text-[10px] font-semibold text-slate-500">{point.label}</div>
                </div>
              );
            })
          )}
        </div>
      </article>

      <article className="rounded-xl border border-line/50 bg-panel p-4 shadow">
        <h4 className="text-lg font-extrabold text-primary">Pending Leave Queue</h4>
        <p className="mb-4 mt-1 text-xs text-slate-600">Top pending approvals from leave applications.</p>

        <div className="max-h-72 overflow-auto rounded-lg border border-line/40">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left font-bold">Staff</th>
                <th className="px-2 py-2 text-left font-bold">Type</th>
                <th className="px-2 py-2 text-left font-bold">Days</th>
              </tr>
            </thead>
            <tbody>
              {pendingLeaves.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                    No pending leave records.
                  </td>
                </tr>
              ) : (
                pendingLeaves.map((row) => (
                  <tr key={row.id} className="border-t border-line/40">
                    <td className="px-2 py-2">
                      <div className="font-semibold text-slate-800">{row.staffName}</div>
                      <div className="text-[10px] text-slate-500">{row.fromDate} - {row.toDate}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{row.leaveType}</td>
                    <td className="px-2 py-2 font-bold text-primary">{row.days}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
