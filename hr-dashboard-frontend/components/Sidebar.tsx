import { EndpointGroup } from '@/types/hr';

type Props = {
  groups: EndpointGroup[];
  activeGroupId: string;
  onChange: (id: string) => void;
};

export function Sidebar({ groups, activeGroupId, onChange }: Props) {
  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col bg-primary p-4 text-white shadow-2xl md:flex">
      <div className="px-2 py-6">
        <h1 className="text-xl font-black">Curator HR</h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">Enterprise Suite</p>
      </div>
      <nav className="space-y-1 overflow-y-auto">
        {groups.map((group) => {
          const active = group.id === activeGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onChange(group.id)}
              className={[
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition',
                active ? 'bg-primaryContainer text-white ring-1 ring-cyan-300/50' : 'text-cyan-100/70 hover:bg-primaryContainer hover:text-white',
              ].join(' ')}
            >
              <span className="text-base">{group.icon}</span>
              <span>{group.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
