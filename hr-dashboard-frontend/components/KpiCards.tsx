type Props = {
  totalStaff: string;
  presentToday: string;
  pendingLeaves: string;
  draftPayroll: string;
};

const cardClass = 'rounded-xl bg-panel shadow p-5 border border-line/40';

export function KpiCards({ totalStaff, presentToday, pendingLeaves, draftPayroll }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <section className={cardClass}>
        <p className="text-xs font-semibold text-slate-500">Total Staff</p>
        <h3 className="mt-2 text-4xl font-extrabold text-primary">{totalStaff}</h3>
      </section>
      <section className={cardClass}>
        <p className="text-xs font-semibold text-slate-500">Present Today</p>
        <h3 className="mt-2 text-4xl font-extrabold text-primary">{presentToday}</h3>
      </section>
      <section className={cardClass}>
        <p className="text-xs font-semibold text-slate-500">Pending Leaves</p>
        <h3 className="mt-2 text-4xl font-extrabold text-primary">{pendingLeaves}</h3>
      </section>
      <section className={cardClass}>
        <p className="text-xs font-semibold text-slate-500">Draft Payroll Rows</p>
        <h3 className="mt-2 text-4xl font-extrabold text-primary">{draftPayroll}</h3>
      </section>
    </div>
  );
}
