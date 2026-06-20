import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Megaphone, PlusCircle, PawPrint } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { name: 'New Campaign', path: '/campaigns/new', icon: PlusCircle },
  ];

  return (
    <div className="w-64 bg-sidebar text-slate-400 flex flex-col h-full z-10 border-r border-brand-800">
      <div className="h-20 flex items-center px-8 border-b border-white/5">
        <PawPrint className="text-accent-400 w-8 h-8 mr-3" />
        <span className="text-xl font-semibold text-white tracking-tight">PawLife</span>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/campaigns'}
              className={({ isActive }) =>
                `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-600/10 text-white border-l-2 border-accent-500'
                    : 'hover:bg-white/5 hover:text-slate-200 border-l-2 border-transparent'
                }`
              }
            >
              <Icon className={`w-5 h-5 mr-3 transition-colors ${item.name === 'Dashboard' ? '' : ''}`} />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-6 border-t border-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-brand-800 flex items-center justify-center text-accent-400 font-semibold border border-brand-700">
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Marketer</p>
            <p className="text-xs text-slate-500">pawlife.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
