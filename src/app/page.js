"use client";

import { useEffect, useState } from "react";
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
  // State for Goals
  const [goals, setGoals] = useState([]);
  const [activeGoalId, setActiveGoalId] = useState(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  // State for Habits and Completions
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  
  const [loading, setLoading] = useState(true);

  // 1. Initial Load: Fetch Goals
  useEffect(() => {
    fetchGoals();
  }, []);

  // 2. When Active Goal changes, fetch its habits and completions
  useEffect(() => {
    if (activeGoalId) {
      fetchHabitsAndCompletions(activeGoalId);
    } else {
      setHabits([]);
      setCompletions([]);
    }
  }, [activeGoalId]);

  async function fetchGoals() {
    setLoading(true);
    const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
    if (data && data.length > 0) {
      setGoals(data);
      if (!activeGoalId) setActiveGoalId(data[0].id);
    }
    setLoading(false);
  }

  async function fetchHabitsAndCompletions(goalId) {
    setLoading(true);
    // Fetch habits for this goal
    const { data: habitsData } = await supabase
      .from('habits')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: true });
    
    setHabits(habitsData || []);

    // Fetch completions
    if (habitsData && habitsData.length > 0) {
      const habitIds = habitsData.map(h => h.id);
      const { data: completionsData } = await supabase
        .from('completions')
        .select('*')
        .in('habit_id', habitIds);
      setCompletions(completionsData || []);
    } else {
      setCompletions([]);
    }
    setLoading(false);
  }

  // --- Add/Delete Goal ---
  async function addGoal(e) {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    
    const { data } = await supabase.from('goals').insert([{ 
      title: newGoalTitle, 
      subtitle: 'Focus on growth' 
    }]).select();

    if (data) {
      setGoals([...goals, data[0]]);
      setActiveGoalId(data[0].id);
      setNewGoalTitle("");
    }
  }

  // --- Add/Delete/Toggle Habit ---
  async function addHabit(e) {
    e.preventDefault();
    if (!newHabitTitle.trim() || !activeGoalId) return;

    const icons = ['✨', '🚀', '⚡️', '🔥', '💧', '☀️', '🏃🏻‍♀️', '🧘🏻‍♂️'];
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];

    const { data } = await supabase.from('habits').insert([{ 
      title: newHabitTitle, 
      icon: randomIcon,
      goal_id: activeGoalId
    }]).select();

    if (data) {
      setNewHabitTitle("");
      setHabits([...habits, data[0]]);
    }
  }

  async function deleteHabit(habitId) {
    await supabase.from('habits').delete().eq('id', habitId);
    setHabits(habits.filter(h => h.id !== habitId));
    setCompletions(completions.filter(c => c.habit_id !== habitId));
  }

  async function toggleCompletion(habitId) {
    // Get today's date in local time (YYYY-MM-DD)
    const d = new Date();
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    
    // Check if already completed today
    const existingCompletion = completions.find(c => c.habit_id === habitId && c.completed_date === today);

    if (existingCompletion) {
      // Uncheck it
      await supabase.from('completions').delete().eq('id', existingCompletion.id);
      setCompletions(completions.filter(c => c.id !== existingCompletion.id));
    } else {
      // Check it
      const { data } = await supabase.from('completions').insert([{ 
        habit_id: habitId, 
        completed_date: today 
      }]).select();
      
      if (data) {
        setCompletions([...completions, data[0]]);
      }
    }
  }

  // --- Calendar Logic ---
  // Get today's date in local time to prevent timezone shifting bugs
  const todayDate = new Date();
  const todayStr = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0');

  // Generate an array of the last 28 days
  const calendarDays = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(todayDate.getDate() - (27 - i));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });

  // Calculate intensity (count of completions) per day
  const completionsPerDay = {};
  completions.forEach(c => {
    completionsPerDay[c.completed_date] = (completionsPerDay[c.completed_date] || 0) + 1;
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

      {/* Goal Selection Tabs */}
      <div className={styles.goalSection}>
        <h2>Macro Goals (Big Picture)</h2>
        <div className={styles.goalTabs}>
          {goals.map(goal => (
            <button 
              key={goal.id}
              className={`${styles.goalTab} ${activeGoalId === goal.id ? styles.active : ''}`}
              onClick={() => setActiveGoalId(goal.id)}
            >
              {goal.title}
            </button>
          ))}
        </div>
        
        {/* Add New Goal Form */}
        <form className={styles.newGoalForm} onSubmit={addGoal}>
          <input 
            type="text" 
            placeholder="Step 1: Create a new Macro Goal..." 
            className={styles.goalInput}
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
          />
          <button type="submit" className={styles.addGoalBtn}>+</button>
        </form>
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
          {/* Daily Dashboard */}
          <section className={styles.habitsList}>
            <h2>Micro Habits (Daily Steps)</h2>

            {/* Add New Habit */}
            <form className={styles.addHabitForm} onSubmit={addHabit}>
              <input 
                type="text" 
                placeholder="Step 2: Add a daily Micro Habit..." 
                className={styles.habitInput}
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
              />
              <button type="submit" className={styles.addBtn}>Add</button>
            </form>
            
            {habits.length === 0 ? (
              <div className={styles.emptyStateSmall}>
                <p>Awesome! Now add a specific daily task above to start making progress.</p>
              </div>
            ) : (
              habits.map((habit) => {
                const isCompletedToday = completions.some(c => c.habit_id === habit.id && c.completed_date === todayStr);

                return (
                  <div key={habit.id} className={`${styles.habitCard} ${isCompletedToday ? styles.completed : ''}`}>
                    <div className={styles.habitMeta}>
                      <span className={styles.icon}>{habit.icon}</span>
                      <div>
                        <h3>{habit.title}</h3>
                        <p>Daily Routine</p>
                      </div>
                    </div>
                    
                    <div className={styles.habitActions}>
                      <button className={styles.deleteBtn} onClick={() => deleteHabit(habit.id)}>🗑️</button>
                      <button 
                        className={isCompletedToday ? styles.checkButton : styles.emptyCircle}
                        onClick={() => toggleCompletion(habit.id)}
                      >
                        {isCompletedToday ? '✓' : ''}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Feature 3: Visual Calendar */}
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
