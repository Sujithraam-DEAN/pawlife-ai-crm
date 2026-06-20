const StatCard = ({ title, value, icon: Icon, trend }) => {
  return (
    <div className="card p-8 group overflow-hidden">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-1">{title}</h3>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{value}</h2>
        </div>
        <div className="p-3 bg-accent-50 text-accent-600 rounded-lg group-hover:scale-105 transition-transform duration-300">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold mr-2">
            Up
          </span>
          <p className="text-sm font-semibold text-emerald-600">
            {trend} <span className="text-slate-400 font-normal ml-1">vs last month</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default StatCard;
