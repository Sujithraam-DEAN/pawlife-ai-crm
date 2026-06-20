const PetOwnerRow = ({ customer, onView }) => {
  return (
    <tr className="hover:bg-accent-50/30 transition-all duration-200 border-b border-slate-50 last:border-0 group">
      <td className="px-6 py-5">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-500 flex items-center justify-center font-bold text-sm mr-4 group-hover:scale-110 transition-transform">
            {customer.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{customer.name}</p>
            <p className="text-xs text-slate-400 font-medium">{customer.phone}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <span className="text-sm text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded-md">{customer.city}</span>
      </td>
      <td className="px-6 py-5">
        <div className="flex -space-x-3">
          {customer.pets?.map((pet, i) => (
            <div
              key={i}
              className="w-9 h-9 rounded-xl bg-white border-2 border-accent-50 flex items-center justify-center text-lg shadow-sm"
              title={`${pet.pet_name} (${pet.breed})`}
            >
              {pet.pet_type === 'dog' ? 'Dog' : 'Cat'}
            </div>
          ))}
        </div>
      </td>
      <td className="px-6 py-5">
        <span className="text-sm font-bold text-slate-700">{customer.total_orders}</span>
      </td>
      <td className="px-6 py-5">
        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Rs. {customer.total_spent?.toLocaleString()}</span>
      </td>
      <td className="px-6 py-5">
        <span className="text-xs font-semibold text-slate-500">
          {customer.last_order_days_ago != null ? `${customer.last_order_days_ago}d ago` : '-'}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <button
          onClick={() => onView(customer._id)}
          className="bg-slate-50 hover:bg-accent-50 text-slate-400 hover:text-accent-500 p-2 rounded-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </td>
    </tr>
  );
};

export default PetOwnerRow;
