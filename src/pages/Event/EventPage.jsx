import React, { useEffect, useMemo, useState } from 'react';
import { Search, Calendar, MapPin, Ticket, ArrowRight } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { fetchEvents } from '../../services/api';

const EventPage = () => {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState({});
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("Semua Venue");
  const [isLoading, setIsLoading] = useState(true); // Tambahan state loading

  useEffect(() => {
    const loadEvents = async () => {
      setIsLoading(true); // Set loading ke true saat mulai fetch
      const data = await fetchEvents();
      
      const gradients = ['from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-emerald-500', 'from-orange-500 to-red-500', 'from-indigo-500 to-blue-500', 'from-rose-500 to-pink-500'];
      
      const transformed = (data || []).map((event, idx) => {
        const date = new Date(event.event_datetime);
        const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        return {
          id: event.event_id,
          title: event.event_title || 'Event tanpa judul',
          date: event.event_datetime,
          venue: venues[event.venue_id] || `Venue ${event.venue_id?.slice(0, 8)}...` || 'Venue tidak diketahui',
          artists: [],
          categories: ['Regular'],
          gradient: gradients[idx % gradients.length],
          time: time,
          startPrice: 150000 + (idx * 50000)
        };
      });
      
      setEvents(transformed);
      setIsLoading(false); // Set loading ke false setelah data berhasil ditransformasi
    };

    loadEvents();
  }, [venues]);

  const filteredEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    return events.filter(event => {
      const titleSafe = event.title || '';
      const artistsSafe = event.artists || [];
      
      const matchesSearch = titleSafe.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            artistsSafe.some(a => (a || '').toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesVenue = selectedVenue === "Semua Venue" || event.venue === selectedVenue;
      return matchesSearch && matchesVenue;
    });
  }, [events, searchQuery, selectedVenue]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Jelajahi Event</h1>
          <p className="text-slate-500 mt-1">Cari dan amankan tiket event favoritmu.</p>
        </div>

        {/* Filter Section */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari event atau artist..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm cursor-pointer md:w-48 shadow-sm"
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
          >
            <option>Semua Venue</option>
            {events && events.length > 0 && Array.from(new Set(events.filter(e => e && e.venue).map(e => e.venue))).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Compact Grid */}
        {isLoading ? (
          /* SKELETON SCREEN SECTION */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden animate-pulse">
                <div className="h-24 bg-slate-200"></div>
                <div className="p-4 flex flex-col flex-grow">
                  <div className="mb-3">
                    <div className="h-5 bg-slate-200 rounded w-3/4 mb-3"></div>
                    <div className="flex gap-1.5 mb-2">
                      <div className="h-4 w-12 bg-slate-200 rounded-md"></div>
                      <div className="h-4 w-16 bg-slate-200 rounded-md"></div>
                    </div>
                    <div className="h-3 bg-slate-200 rounded w-1/2 mb-5"></div>
                  </div>
                  <div className="flex gap-1 mb-4">
                    <div className="h-4 w-14 bg-slate-200 rounded"></div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <div className="h-2 w-12 bg-slate-200 rounded mb-1.5"></div>
                      <div className="h-4 w-20 bg-slate-200 rounded"></div>
                    </div>
                    <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">Tidak ada event yang sesuai dengan pencarian Anda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <div key={event.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden">
                
                {/* Compact Gradient Thumbnail */}
                <div className={`h-24 bg-gradient-to-br ${event.gradient} relative flex items-center justify-center`}>
                  <Ticket className="text-white/20 w-12 h-12 rotate-12" />
                  <div className="absolute bottom-2 right-3 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                    {event.time} WIB
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-grow">
                  <div className="mb-3">
                    <h3 className="font-bold text-slate-900 leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {event.title}
                    </h3>
                  {/* Performer Tags */}
                  <div className="flex flex-wrap gap-1.5 overflow-hidden items-start">
                    {event.artists.map((artist, idx) => (
                      <span key={idx} className="bg-slate-50 text-slate-600 text-[10px] px-2 rounded-md font-semibold border border-slate-100">
                        {artist}
                      </span>
                    ))}
                  </div>
                    <div className="flex items-center text-slate-500 text-[11px] mt-1 gap-2 font-medium mb-5">
                      <Calendar size={12} className="text-slate-400" />
                      <span>{new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="text-slate-300">•</span>
                      <MapPin size={12} className="text-slate-400" />
                      <span className="line-clamp-1">{event.venue}</span>
                    </div>
                  </div>

                  {/* Ticket Categories - ADDED SECTION */}
                  <div className="flex flex-wrap gap-1">
                    {event.categories.map((cat, idx) => (
                      <span key={idx} className="text-[9px] font-bold text-blue-700 bg-blue-50/50 border border-blue-100 px-1.5 py-0.5 rounded uppercase">
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Footer - Compact */}
                  <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-tighter">Mulai Dari</span>
                      <span className="text-sm font-black text-slate-900 leading-none">Rp {event.startPrice.toLocaleString('id-ID')}</span>
                    </div>
                    <button 
                      onClick={() => window.location.href = `/checkout/${event.id}`}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2 px-3 rounded-lg transition-all active:scale-95 group/btn shadow-sm"
                    >
                      Beli Tiket
                      <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default EventPage;