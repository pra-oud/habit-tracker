"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";
import { supabase } from "../lib/supabase";
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <div className={styles.container}><p>Loading...</p></div>;
  }

  if (!session) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Welcome to Habit Tracker</h1>
          <p>Please log in or sign up to secure your data.</p>
        </header>
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <Auth 
            supabaseClient={supabase} 
            appearance={{ theme: ThemeSupa }} 
            providers={[]} 
          />
        </div>
      </div>
    );
  }

  return <Dashboard session={session} />;
}

function Dashboard({ session }) {
  // Main Nav State
  const [currentTab, setCurrentTab] = useState('track');

  // Goal State
  const [goals, setGoals] = useState([]);
  const [activeGoalId, setActiveGoalId] = useState(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTargetDate, setNewGoalTargetDate] = useState("");
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editGoalTitle, setEditGoalTitle] = useState("");

  // Habit State
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitType, setNewHabitType] = useState("checkbox");
  const [newHabitTarget, setNewHabitTarget] = useState("");
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  
  const [calendarOffsetDays, setCalendarOffsetDays] = useState(0);
  const [loading, setLoading] = useState(true);

  // Date Logic
  const d = new Date();
  const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  useEffect(() => { fetchGoals(); }, []);
  useEffect(() => {
    if (activeGoalId) fetchHabitsAndCompletions(activeGoalId);
    else { setHabits([]); setCompletions([]); }
  }, [activeGoalId]);

  async function fetchGoals() {
    setLoading(true);
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
    if (data && data.length > 0) {
      setGoals(data);
      if (!activeGoalId) setActiveGoalId(data[0].id);
    }
    setLoading(false);
  }

  async function fetchHabitsAndCompletions(goalId) {
    setLoading(true);
    const { data: habitsData } = await supabase.from('habits').select('*').eq('goal_id', goalId).order('created_at', { ascending: true });
    setHabits(habitsData || []);

    if (habitsData && habitsData.length > 0) {
      const habitIds = habitsData.map(h => h.id);
      const { data: completionsData } = await supabase.from('completions').select('*').in('habit_id', habitIds);
      setCompletions(completionsData || []);
    } else {
      setCompletions([]);
    }
    setLoading(false);
  }

  // --- Goal Actions ---
  async function addGoal(e) {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    const { data } = await supabase.from('goals').insert([{ 
      title: newGoalTitle, 
      subtitle: 'Focus on growth',
      target_date: newGoalTargetDate || null
    }]).select();
    if (data) {
      setGoals([...goals, data[0]]);
      setActiveGoalId(data[0].id);
      setNewGoalTitle("");
      setNewGoalTargetDate("");
      setIsAddingGoal(false);
    }
  }

  async function saveGoalEdit(id) {
    if (!editGoalTitle.trim()) return;
    await supabase.from('goals').update({ title: editGoalTitle }).eq('id', id);
    setGoals(goals.map(g => g.id === id ? { ...g, title: editGoalTitle } : g));
    setEditingGoalId(null);
  }

  async function deleteGoal(id) {
    await supabase.from('goals').delete().eq('id', id);
    const updatedGoals = goals.filter(g => g.id !== id);
    setGoals(updatedGoals);
    if (activeGoalId === id) {
      setActiveGoalId(updatedGoals.length > 0 ? updatedGoals[0].id : null);
    }
  }

  // --- Habit Actions ---
  async function addHabit(e) {
    e.preventDefault();
    if (!newHabitTitle.trim() || !activeGoalId) return;

    let finalTarget = 1;
    if (newHabitType === 'incremental' || newHabitType === 'numerical') finalTarget = parseInt(newHabitTarget) || 1;
    if (newHabitType === 'timer') finalTarget = (parseInt(newHabitTarget) || 1) * 60;

    const icons = ['✨', '🚀', '⚡️', '🔥', '💧', '☀️', '🏃🏻‍♀️', '🧘🏻‍♂️'];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    const { data } = await supabase.from('habits').insert([{ 
      title: newHabitTitle, 
      icon: randomIcon,
      goal_id: activeGoalId,
      type: newHabitType,
      target_value: finalTarget
    }]).select();

    if (data) {
      setNewHabitTitle("");
      setNewHabitTarget("");
      setNewHabitType("checkbox");
      setIsAddingHabit(false);
      setHabits([...habits, data[0]]);
    }
  }

  // --- Calendar & Analytics ---
  const calendarDays = Array.from({ length: 28 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - i) - calendarOffsetDays);
    return date;
  });

  const completionsPerDay = {};
  completions.forEach(c => {
    const habit = habits.find(h => h.id === c.habit_id);
    if (habit && c.progress_value >= habit.target_value) {
      completionsPerDay[c.completed_date] = (completionsPerDay[c.completed_date] || 0) + 1;
    }
  });

  const userEmail = session.user?.email || "";
  const userName = userEmail ? userEmail.split('@')[0] : "Founder";
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Morning, {formattedName}!</h1>
          <p>Let's make today count.</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className={styles.signOutBtn}>Sign Out</button>
      </header>

      {/* Main Navigation */}
      <div className={styles.topNavTabs}>
        <button className={`${styles.navTab} ${currentTab === 'track' ? styles.navTabActive : ''}`} onClick={() => setCurrentTab('track')}>📋 Track Actions</button>
        <button className={`${styles.navTab} ${currentTab === 'visualize' ? styles.navTabActive : ''}`} onClick={() => setCurrentTab('visualize')}>📊 Insights</button>
      </div>

      {/* Shared Goal Section */}
      <div className={styles.goalSection}>
        <h2>Macro Goals (Big Picture)</h2>
        <div className={styles.goalTabs}>
          {goals.map(goal => (
            <div key={goal.id} className={styles.goalTabWrapper}>
              {editingGoalId === goal.id ? (
                <div className={styles.goalEditRow}>
                  <input type="text" value={editGoalTitle} onChange={(e) => setEditGoalTitle(e.target.value)} className={styles.goalEditInput} autoFocus />
                  <button onClick={() => saveGoalEdit(goal.id)} className={styles.saveBtn}>Save</button>
                  <button onClick={() => setEditingGoalId(null)} className={styles.cancelSmallBtn}>X</button>
                </div>
              ) : (
                <div className={`${styles.goalTabGroup} ${activeGoalId === goal.id ? styles.activeGroup : ''}`}>
                  <button className={`${styles.goalTab} ${activeGoalId === goal.id ? styles.active : ''}`} onClick={() => setActiveGoalId(goal.id)}>
                    {goal.title}
                  </button>
                  {activeGoalId === goal.id && (
                    <div className={styles.goalActions}>
                      <button onClick={() => { setEditingGoalId(goal.id); setEditGoalTitle(goal.title); }} title="Edit">✏️</button>
                      <button onClick={() => deleteGoal(goal.id)} title="Delete">🗑️</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {goals.length > 0 && !isAddingGoal && (
            <button className={styles.addGoalToggleBtn} onClick={() => setIsAddingGoal(true)} title="Add new Macro Goal">+</button>
          )}
        </div>
        
        {(goals.length === 0 || isAddingGoal) && (
          <form className={styles.newGoalFormExpanded} onSubmit={addGoal}>
            <input 
              type="text" 
              placeholder="Step 1: Create a Macro Goal..." 
              className={styles.goalInput}
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              autoFocus={isAddingGoal}
              required
            />
            <input 
              type="date" 
              className={styles.targetDateInput}
              value={newGoalTargetDate}
              onChange={(e) => setNewGoalTargetDate(e.target.value)}
              title="Optional Deadline"
            />
            <button type="submit" className={styles.addGoalBtn}>Add</button>
            {goals.length > 0 && <button type="button" className={styles.cancelBtn} onClick={() => setIsAddingGoal(false)}>Cancel</button>}
          </form>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}

      {!loading && goals.length === 0 && (
        <div className={styles.emptyStateBoard}>
          <h2>Welcome to your Dashboard! 🚀</h2>
          <p><strong>Step 1:</strong> Start by creating a broad Macro Goal above (e.g., "Get Fit").</p>
          <p><strong>Step 2:</strong> Once created, you can add daily Micro Habits to track your progress.</p>
        </div>
      )}

      {!loading && activeGoalId && currentTab === 'track' && (
        <section className={styles.habitsList}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ marginBottom: 0 }}>Micro Habits (Daily Steps)</h2>
            {habits.length > 0 && !isAddingHabit && (
              <button className={styles.addHabitToggleBtn} onClick={() => setIsAddingHabit(true)}>+ Add Habit</button>
            )}
          </div>

          {(habits.length === 0 || isAddingHabit) && (
            <form className={styles.addHabitFormExpanded} onSubmit={addHabit}>
              <div className={styles.formRow}>
                <select className={styles.typeSelect} value={newHabitType} onChange={(e) => setNewHabitType(e.target.value)}>
                  <option value="checkbox">✓ Checkbox</option>
                  <option value="incremental">+ Incremental</option>
                  <option value="numerical"># Numerical</option>
                  <option value="timer">⏱ Timer</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Habit name..." 
                  className={styles.habitInputFull}
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  autoFocus={isAddingHabit}
                  required
                />
              </div>
              
              {newHabitType !== 'checkbox' && (
                <div className={styles.formRow}>
                  <input 
                    type="number" 
                    placeholder={newHabitType === 'timer' ? 'Target in minutes...' : 'Target value...'} 
                    className={styles.targetInput}
                    value={newHabitTarget}
                    onChange={(e) => setNewHabitTarget(e.target.value)}
                    required
                    min="1"
                  />
                </div>
              )}
              
              <div className={styles.formActions}>
                <button type="submit" className={styles.addBtn}>Save Habit</button>
                {habits.length > 0 && <button type="button" className={styles.cancelBtn} onClick={() => setIsAddingHabit(false)}>Cancel</button>}
              </div>
            </form>
          )}
          
          {habits.length === 0 ? (
            <div className={styles.emptyStateSmall}>
              <p>Awesome! Now add a specific daily task above to start making progress.</p>
            </div>
          ) : (
            habits.map((habit) => (
              <HabitCard 
                key={habit.id} 
                habit={habit} 
                todayStr={todayStr}
                completions={completions} 
                setCompletions={setCompletions}
                onDelete={() => {
                  supabase.from('habits').delete().eq('id', habit.id).then(() => {
                    setHabits(habits.filter(h => h.id !== habit.id));
                  });
                }}
                onUpdateTitle={(newTitle) => {
                  setHabits(habits.map(h => h.id === habit.id ? { ...h, title: newTitle } : h));
                }}
              />
            ))
          )}
        </section>
      )}

      {!loading && activeGoalId && currentTab === 'visualize' && (
        <div className={styles.insightsDashboard}>
          {/* Deadline Visualization */}
          <DeadlineTracker goal={goals.find(g => g.id === activeGoalId)} />
          
          {/* Calendar Visualization */}
          <section className={styles.calendarWidget}>
            <div className={styles.calendarHeader}>
              <h2>Progress Intensity</h2>
              <div className={styles.calendarControls}>
                <button onClick={() => setCalendarOffsetDays(prev => prev + 28)}>←</button>
                <span>{calendarDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {calendarDays[27].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <button onClick={() => setCalendarOffsetDays(prev => Math.max(0, prev - 28))} disabled={calendarOffsetDays === 0}>→</button>
              </div>
            </div>
            <div className={styles.grid}>
              {calendarDays.map((dateObj) => {
                const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
                const dayNum = dateObj.getDate();
                const count = completionsPerDay[dateStr] || 0;
                let cellClass = styles.gridCell;
                if (count === 1) cellClass += ` ${styles.activeCell1}`;
                else if (count === 2) cellClass += ` ${styles.activeCell2}`;
                else if (count >= 3) cellClass += ` ${styles.activeCell3}`;
                
                return (
                  <div key={dateStr} className={cellClass} title={`${count} completed on ${dateStr}`}>
                    <span className={styles.cellDay}>{dayNum}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DeadlineTracker({ goal }) {
  if (!goal) return null;

  if (!goal.target_date) {
    return (
      <div className={styles.insightCard}>
        <h3>🎯 Target Deadline</h3>
        <p style={{ color: 'var(--text-muted)' }}>No deadline set. This is a forever goal! 🚀</p>
      </div>
    );
  }

  const start = new Date(goal.created_at).getTime();
  const target = new Date(goal.target_date).getTime();
  const today = new Date().getTime();

  const totalDays = Math.max(1, Math.ceil((target - start) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
  const remainingDays = totalDays - elapsedDays;
  
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  return (
    <div className={styles.insightCard}>
      <h3>⏳ Deadline Countdown</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{remainingDays > 0 ? `${remainingDays} days remaining` : 'Deadline passed!'}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{percent}% Elapsed</span>
      </div>
      <div className={styles.progressBarBg}>
        <div className={styles.progressBarFill} style={{ width: `${percent}%`, backgroundColor: percent >= 90 ? '#ff6b6b' : 'var(--pastel-green-hover)' }}></div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
        Target Date: {new Date(goal.target_date).toLocaleDateString()}
      </p>
    </div>
  );
}

// Sub-component for individual habits to manage their own progress/timer state
function HabitCard({ habit, todayStr, completions, setCompletions, onDelete, onUpdateTitle }) {
  const completion = completions.find(c => c.habit_id === habit.id && c.completed_date === todayStr);
  const currentProgress = completion ? completion.progress_value : 0;
  const isCompleted = currentProgress >= habit.target_value;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(habit.title);

  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(currentProgress);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isRunning) setTimerSeconds(currentProgress);
  }, [currentProgress, isRunning]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
           const next = prev + 1;
           if (next >= habit.target_value) {
              clearInterval(intervalRef.current);
              setIsRunning(false);
              updateProgress(next);
           }
           return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, habit.target_value]);

  async function updateProgress(newProgress) {
    if (newProgress < 0) newProgress = 0;
    if (newProgress > habit.target_value) newProgress = habit.target_value;
    
    if (completion) {
      if (newProgress === 0) {
        await supabase.from('completions').delete().eq('id', completion.id);
        setCompletions(prev => prev.filter(c => c.id !== completion.id));
      } else {
        await supabase.from('completions').update({ progress_value: newProgress }).eq('id', completion.id);
        setCompletions(prev => prev.map(c => c.id === completion.id ? { ...c, progress_value: newProgress } : c));
      }
    } else if (newProgress > 0) {
      const { data } = await supabase.from('completions').insert([{ 
        habit_id: habit.id, 
        completed_date: todayStr,
        progress_value: newProgress
      }]).select();
      if (data) setCompletions(prev => [...prev, data[0]]);
    }
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    await supabase.from('habits').update({ title: editTitle }).eq('id', habit.id);
    onUpdateTitle(editTitle);
    setIsEditing(false);
  }

  const progressPercent = Math.min(100, Math.round((currentProgress / habit.target_value) * 100));

  return (
    <div className={`${styles.habitCard} ${isCompleted ? styles.completed : ''}`}>
      <div className={styles.habitContentArea}>
        <div className={styles.habitMeta}>
          <span className={styles.icon}>{habit.icon}</span>
          <div style={{ flex: 1 }}>
            {isEditing ? (
              <div className={styles.editRow}>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={styles.goalEditInput} autoFocus />
                <button onClick={saveEdit} className={styles.saveBtn}>Save</button>
                <button onClick={() => setIsEditing(false)} className={styles.cancelSmallBtn}>X</button>
              </div>
            ) : (
              <h3 className={styles.habitTitle}>
                {habit.title} 
                <button className={styles.inlineEditBtn} onClick={() => setIsEditing(true)}>✏️</button>
              </h3>
            )}
            
            {habit.type !== 'checkbox' && (
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} style={{ width: `${isRunning ? Math.min(100, (timerSeconds/habit.target_value)*100) : progressPercent}%` }}></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.habitActions}>
        <button className={styles.deleteBtn} onClick={onDelete}>🗑️</button>

        {habit.type === 'checkbox' && (
          <button className={isCompleted ? styles.checkButton : styles.emptyCircle} onClick={() => updateProgress(isCompleted ? 0 : 1)}>
            {isCompleted ? '✓' : ''}
          </button>
        )}

        {habit.type === 'incremental' && (
          <div className={styles.controlGroup}>
            <button className={styles.circleBtn} onClick={() => updateProgress(currentProgress - 1)}>-</button>
            <span className={styles.progressText}>{currentProgress} / {habit.target_value}</span>
            <button className={styles.circleBtn} onClick={() => updateProgress(currentProgress + 1)}>+</button>
          </div>
        )}

        {habit.type === 'numerical' && (
          <div className={styles.controlGroup}>
            <input type="number" className={styles.numberInlineInput} value={currentProgress === 0 ? "" : currentProgress} placeholder="0" onChange={(e) => updateProgress(parseInt(e.target.value) || 0)} />
            <span className={styles.progressText}>/ {habit.target_value}</span>
          </div>
        )}

        {habit.type === 'timer' && (
          <div className={styles.controlGroup}>
            <span className={styles.progressText}>{formatTime(timerSeconds)} / {formatTime(habit.target_value)}</span>
            {isCompleted ? (
              <span className={styles.completedBadge}>✓</span>
            ) : (
              <button className={`${styles.playBtn} ${isRunning ? styles.running : ''}`} onClick={() => {
                  if (isRunning) { setIsRunning(false); updateProgress(timerSeconds); }
                  else { setIsRunning(true); }
                }}>
                {isRunning ? '⏸' : '▶'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
