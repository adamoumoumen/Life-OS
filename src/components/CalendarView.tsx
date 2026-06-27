import { useState } from 'react';
import { 
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth, 
  eachDayOfInterval, isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarView({ tasks }: { tasks: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');

  const handlePrev = () => {
    if (view === 'day') setCurrentDate(subDays(currentDate, 1));
    if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNext = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.startTime) return false;
      return isSameDay(new Date(task.startTime), date);
    });
  };

  const renderDayView = () => {
    const dayTasks = getTasksForDate(currentDate);
    return (
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mt-4">
        {dayTasks.length === 0 ? (
          <div className="text-center text-zinc-500 py-10">No tasks scheduled for this day.</div>
        ) : (
          dayTasks.map((task: any, i: number) => (
            <div key={task.id || i} className="flex items-start gap-4">
              <div className="w-16 text-right text-xs font-mono text-zinc-500 pt-1">
                {task.startTime ? format(new Date(task.startTime), 'HH:mm') : '--:--'}
              </div>
              <div className="flex-1 p-3 rounded bg-zinc-800/50 border border-zinc-700/50">
                <p className="font-medium text-sm text-zinc-300">{task.title}</p>
                {task.description && <p className="text-xs text-zinc-500 mt-1">{task.description}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="flex-1 mt-4 grid grid-cols-7 gap-2 overflow-y-auto">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-col h-full min-h-[400px] border border-zinc-800 rounded-lg overflow-hidden">
            <div className={`text-center py-2 text-xs font-bold border-b border-zinc-800 ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
              <div>{format(day, 'EEE')}</div>
              <div className="text-lg mt-1">{format(day, 'd')}</div>
            </div>
            <div className="flex-1 bg-zinc-900/50 p-1 space-y-1 overflow-y-auto">
              {getTasksForDate(day).map((task, i) => (
                <div key={i} className="text-[10px] p-1.5 bg-zinc-800 text-zinc-300 rounded leading-tight truncate border border-zinc-700/50">
                  {format(new Date(task.startTime), 'HH:mm')} - {task.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMonthView = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="flex-1 mt-4 flex flex-col min-h-0">
        <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-zinc-500 py-1">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1 overflow-y-auto">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            return (
              <div key={idx} className={`border border-zinc-800 rounded-md p-1 flex flex-col ${isCurrentMonth ? 'bg-zinc-900/80' : 'bg-zinc-900/20'} ${isSameDay(day, new Date()) ? 'ring-1 ring-indigo-500' : ''}`}>
                <div className={`text-right text-xs p-1 ${isSameDay(day, new Date()) ? 'text-indigo-400 font-bold' : isCurrentMonth ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {format(day, 'd')}
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  {getTasksForDate(day).slice(0, 3).map((task, i) => (
                    <div key={i} className="text-[9px] px-1 py-0.5 bg-zinc-800 text-zinc-400 rounded truncate">
                      {format(new Date(task.startTime), 'HH:mm')} {task.title}
                    </div>
                  ))}
                  {getTasksForDate(day).length > 3 && (
                    <div className="text-[9px] text-zinc-500 px-1">
                      +{getTasksForDate(day).length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-accent-blue" /> 
          Calendar
        </h2>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button 
              onClick={() => setView('day')} 
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Day
            </button>
            <button 
              onClick={() => setView('week')} 
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Week
            </button>
            <button 
              onClick={() => setView('month')} 
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleToday} className="px-3 py-1 text-xs font-medium bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md text-zinc-300">
              Today
            </button>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <button onClick={handlePrev} className="p-1.5 hover:bg-zinc-800 text-zinc-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNext} className="p-1.5 hover:bg-zinc-800 text-zinc-400 border-l border-zinc-800">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-lg font-medium text-zinc-200">
        {view === 'day' && format(currentDate, 'MMMM d, yyyy')}
        {view === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
        {view === 'month' && format(currentDate, 'MMMM yyyy')}
      </div>

      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}
    </div>
  );
}
