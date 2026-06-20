import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, X, Package, Calendar, Users, MapPin, Rocket } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/axios';
import toast from 'react-hot-toast';
import PetOwnerRow from '../components/PetOwnerRow';

const CITIES = ['', 'Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Hyderabad', 'Pune'];
const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    city: '',
    pet_type: '',
    breed: '',
    last_order_days_ago: '',
  });

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setError(null);
    try {
      const params = {};
      if (filters.city) params.city = filters.city;
      if (filters.pet_type) params.pet_type = filters.pet_type;
      if (filters.breed) params.breed = filters.breed;
      if (filters.last_order_days_ago) params.last_order_days_ago = Number(filters.last_order_days_ago);

      const res = await api.get('/customers', { params });
      setCustomers(res.data);
    } catch (err) {
      console.error('Error fetching customers', err);
      setError('Could not load customers. Please try again.');
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    fetchCustomers();
  }, [fetchCustomers]);

  const viewCustomer = async (id) => {
    setSelectedCustomer(id);
    setProfileLoading(true);
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomerProfile(res.data);
    } catch (err) {
      console.error('Error fetching profile', err);
      toast.error('Failed to load customer profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedCustomer(null);
    setCustomerProfile(null);
  };

  const clearFilters = () => {
    setFilters({ city: '', pet_type: '', breed: '', last_order_days_ago: '' });
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto relative animate-fade-in">
      <div className="mb-10 flex justify-between items-center flex-wrap gap-6">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-slate-500 font-medium mt-2">
            Showing <span className="text-accent-600">{filteredCustomers.length}</span> of {customers.length} pet owners
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-accent-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-5 py-3 bg-white/50 backdrop-blur-sm border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent-500/10 focus:bg-white w-72 shadow-sm transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
              showFilters 
                ? 'bg-accent-600 text-white shadow-lg shadow-accent-500/20' 
                : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Filter className={`w-4 h-4 mr-2 ${showFilters ? 'text-white' : 'text-slate-400'}`} /> Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card p-8 mb-10 grid grid-cols-1 md:grid-cols-5 gap-6 items-end animate-fade-in shadow-sm ring-1 ring-accent-50">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">City</label>
            <select
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent-500/10 focus:bg-white transition-all"
            >
              <option value="">All cities</option>
              {CITIES.filter(Boolean).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">Pet type</label>
            <select
              value={filters.pet_type}
              onChange={(e) => setFilters({ ...filters, pet_type: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent-500/10 focus:bg-white transition-all"
            >
              <option value="">All pets</option>
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">Breed</label>
            <input
              type="text"
              placeholder="e.g. Labrador"
              value={filters.breed}
              onChange={(e) => setFilters({ ...filters, breed: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent-500/10 focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">
              Dormant {filters.last_order_days_ago || 0}d+
            </label>
            <div className="px-1">
              <input
                type="range"
                min="0"
                max="90"
                value={filters.last_order_days_ago || 0}
                onChange={(e) => setFilters({ ...filters, last_order_days_ago: e.target.value === '0' ? '' : e.target.value })}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-accent-600"
              />
            </div>
          </div>
          <button onClick={clearFilters} className="btn-secondary text-xs uppercase tracking-widest font-bold py-3">Clear</button>
        </div>
      )}

      {error && (
        <div className="mb-10 p-6 bg-red-50 border border-red-100 rounded-[2rem] text-red-700 text-sm flex justify-between items-center shadow-sm">
          <span className="flex items-center"><X className="w-5 h-5 mr-3 bg-white p-1 rounded-full text-red-500" /> {error}</span>
          <button onClick={fetchCustomers} className="font-bold hover:underline">Retry</button>
        </div>
      )}

      <div className="card flex-1 overflow-hidden flex flex-col border border-white/50 shadow-sm">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-bold tracking-[0.15em] border-b border-slate-50">
                <th className="px-8 py-5 font-bold">Pet Owner</th>
                <th className="px-8 py-5 font-bold">City</th>
                <th className="px-8 py-5 font-bold">Pets</th>
                <th className="px-8 py-5 font-bold text-center">Orders</th>
                <th className="px-8 py-5 font-bold">Total Spent</th>
                <th className="px-8 py-5 font-bold">Activity</th>
                <th className="px-8 py-5 font-bold text-right pr-12">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-500" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Database...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl mb-4 opacity-20">Search</div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">No matching pet owners found</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.map((customer) => (
                <PetOwnerRow key={customer._id} customer={customer} onView={viewCustomer} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md z-50 flex justify-end" onClick={closeProfile}>
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-in relative" onClick={(e) => e.stopPropagation()}>
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-accent-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-accent-200">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Profile</h2>
              </div>
              <button 
                onClick={closeProfile} 
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-400 transition-all active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              {profileLoading || !customerProfile ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600"></div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading profile...</p>
                </div>
              ) : (
                <div className="space-y-12">
                  <div className="bg-accent-50/50 p-8 rounded-[2rem] border border-accent-100 flex items-center">
                    <div className="w-20 h-20 rounded-3xl bg-white text-accent-600 flex items-center justify-center font-black text-4xl shadow-sm mr-6 border border-white">
                      {customerProfile.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{customerProfile.name}</h3>
                      <div className="flex items-center text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">
                        <MapPin className="w-3 h-3 mr-1.5 text-accent-400" /> {customerProfile.city}
                      </div>
                      <p className="text-slate-400 font-medium text-sm mt-1">{customerProfile.email}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
                      <span className="w-1.5 h-1.5 bg-accent-500 rounded-full mr-3"></span>
                      Pets Owned
                    </h4>
                    <div className="grid gap-4">
                      {customerProfile.pets?.map(pet => (
                        <div key={pet.pet_id} className="card p-6 bg-white border-slate-100 hover:border-accent-100 transition-colors flex items-start group">
                          <div className="text-4xl mr-5 group-hover:scale-110 transition-transform duration-300 shadow-inner bg-slate-50 p-3 rounded-2xl border border-white">
                            {pet.pet_type === 'dog' ? 'Dog' : 'Cat'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-lg">{pet.pet_name}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">{pet.breed}</span>
                              <span className="text-[10px] bg-accent-50 text-accent-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">{pet.age_years} yrs</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-3 font-semibold flex items-center">
                              <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" /> Born: {pet.birthday}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
                      <span className="w-1.5 h-1.5 bg-accent-500 rounded-full mr-3"></span>
                      Recent Orders
                    </h4>
                    {customerProfile.orders?.length > 0 ? (
                      <div className="card overflow-hidden border-slate-50 bg-white">
                        {customerProfile.orders.slice(0, 5).map((order, idx) => (
                          <div key={order._id} className={`p-5 ${idx !== 0 ? 'border-t border-slate-50' : ''} flex justify-between items-center hover:bg-slate-50 transition-colors`}>
                            <div className="flex items-start">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-4 shrink-0 shadow-inner">
                                <Package className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 line-clamp-1">{order.product_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  {order.product_category} - {format(new Date(order.ordered_at), 'MMM d')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-slate-900 text-sm">Rs. {order.amount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No transaction history</p>
                      </div>
                    )}
                  </div>

                  {customerProfile.restock_prediction && (
                    <div className={`p-8 rounded-[2rem] border-2 shadow-xl shadow-black/5 animate-pulse relative overflow-hidden ${
                      customerProfile.restock_prediction.status === 'overdue' 
                        ? 'bg-red-50/50 border-red-100 text-red-900' 
                        : customerProfile.restock_prediction.status === 'due'
                        ? 'bg-amber-50/50 border-amber-100 text-amber-900'
                        : 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
                    }`}>
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Rocket className="w-16 h-16" />
                      </div>
                      <h4 className="font-extrabold text-[10px] uppercase tracking-[0.2em] mb-2">Restock Intelligence</h4>
                      <p className="text-sm font-bold leading-relaxed">{customerProfile.restock_prediction.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
