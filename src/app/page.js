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
  // Goal State
  const [goals, setGoals] = useState([]);
  const [activeGoalId, setActiveGoalId] = useState(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");
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
    const { data } = await supabase.from('goals').insert([{ title: newGoalTitle, subtitle: 'Focus on growth' }]).select();
    if (data) {
      setGoals([...goals, data[0]]);
      setActiveGoalId(data[0].id);
      setNewGoalTitle("");
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
    if (newHabitType === 'timer') finalTarget = (parseInt(newHabitTarget) || 1) * 60; // Convert mins to seconds

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

  // --- Calendar Generation ---
  const calendarDays = Array.from({ length: 28 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - i));
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  });

  const completionsPerDay = {};
  // Count how many habits reached their target on each day
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
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Sign Out
        </button>
      </header>

      {/* Goal Section */}
      <div className={styles.goalSection}>
        <h2>Macro Goals (Big Picture)</h2>
        <div className={styles.goalTabs}>
          {goals.map(goal => (
            <div key={goal.id} className={styles.goalTabWrapper}>
              {editingGoalId === goal.id ? (
                <div className={styles.goalEditRow}>
                  <input 
                    type="text" 
                    value={editGoalTitle} 
                    onChange={(e) => setEditGoalTitle(e.target.value)}
                    className={styles.goalEditInput}
                    autoFocus
                  />
                  <button onClick={() => saveGoalEdit(goal.id)} className={styles.saveBtn}>Save</button>
                  <button onClick={() => setEditingGoalId(null)} className={styles.cancelSmallBtn}>X</button>
                </div>
              ) : (
                <div className={`${styles.goalTabGroup} ${activeGoalId === goal.id ? styles.activeGroup : ''}`}>
                  <button 
                    className={`${styles.goalTab} ${activeGoalId === goal.id ? styles.active : ''}`}
                    onClick={() => setActiveGoalId(goal.id)}
                  >
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
          <form className={styles.newGoalForm} onSubmit={addGoal}>
            <input 
              type="text" 
              placeholder="Step 1: Create a new Macro Goal..." 
              className={styles.goalInput}
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              autoFocus={isAddingGoal}
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

      {!loading && activeGoalId && (
        <>
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
                  <select 
                    className={styles.typeSelect} 
                    value={newHabitType} 
                    onChange={(e) => setNewHabitType(e.target.value)}
                  >
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

          <section className={styles.calendarWidget}>
            <h2>Progress Calendar (Last 28 Days)</h2>
            <div className={styles.grid}>
              {calendarDays.map((dateStr) => {
                const count = completionsPerDay[dateStr] || 0;
                let cellClass = styles.gridCell;
                if (count === 1) cellClass += ` ${styles.activeCell1}`;
                else if (count === 2) cellClass += ` ${styles.activeCell2}`;
                else if (count >= 3) cellClass += ` ${styles.activeCell3}`;
                
                return <div key={dateStr} className={cellClass} title={`${count} completed on ${dateStr}`}></div>;
              })}
            </div>
          </section>
        </>
      )}
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

  // Sync timer when externally updated
  useEffect(() => {
    if (!isRunning) setTimerSeconds(currentProgress);
  }, [currentProgress, isRunning]);

  // Stopwatch Logic
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

  // Calculate Progress Bar width
  const progressPercent = Math.min(100, Math.round((currentProgress / habit.target_value) * 100));

  return (
    <div className={`${styles.habitCard} ${isCompleted ? styles.completed : ''}`}>
      <div className={styles.habitContentArea}>
        <div className={styles.habitMeta}>
          <span className={styles.icon}>{habit.icon}</span>
          <div style={{ flex: 1 }}>
            {isEditing ? (
              <div className={styles.editRow}>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  className={styles.goalEditInput}
                  autoFocus
                />
                <button onClick={saveEdit} className={styles.saveBtn}>Save</button>
                <button onClick={() => setIsEditing(false)} className={styles.cancelSmallBtn}>X</button>
              </div>
            ) : (
              <h3 className={styles.habitTitle}>
                {habit.title} 
                <button className={styles.inlineEditBtn} onClick={() => setIsEditing(true)}>✏️</button>
              </h3>
            )}
            
            {/* Progress Bar for non-checkbox types */}
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

        {/* 1. Checkbox Logic */}
        {habit.type === 'checkbox' && (
          <button 
            className={isCompleted ? styles.checkButton : styles.emptyCircle}
            onClick={() => updateProgress(isCompleted ? 0 : 1)}
          >
            {isCompleted ? '✓' : ''}
          </button>
        )}

        {/* 2. Incremental Logic */}
        {habit.type === 'incremental' && (
          <div className={styles.controlGroup}>
            <button className={styles.circleBtn} onClick={() => updateProgress(currentProgress - 1)}>-</button>
            <span className={styles.progressText}>{currentProgress} / {habit.target_value}</span>
            <button className={styles.circleBtn} onClick={() => updateProgress(currentProgress + 1)}>+</button>
          </div>
        )}

        {/* 3. Numerical Logic */}
        {habit.type === 'numerical' && (
          <div className={styles.controlGroup}>
            <input 
              type="number" 
              className={styles.numberInlineInput}
              value={currentProgress === 0 ? "" : currentProgress}
              placeholder="0"
              onChange={(e) => updateProgress(parseInt(e.target.value) || 0)}
            />
            <span className={styles.progressText}>/ {habit.target_value}</span>
          </div>
        )}

        {/* 4. Timer Logic */}
        {habit.type === 'timer' && (
          <div className={styles.controlGroup}>
            <span className={styles.progressText}>{formatTime(timerSeconds)} / {formatTime(habit.target_value)}</span>
            {isCompleted ? (
              <span className={styles.completedBadge}>✓</span>
            ) : (
              <button 
                className={`${styles.playBtn} ${isRunning ? styles.running : ''}`} 
                onClick={() => {
                  if (isRunning) { setIsRunning(false); updateProgress(timerSeconds); }
                  else { setIsRunning(true); }
                }}
              >
                {isRunning ? '⏸' : '▶'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
