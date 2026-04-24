"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { supabase } from "../lib/supabase";

export default function Home() {
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
    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
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
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];

  // Generate an array of the last 28 days
  const calendarDays = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(todayDate.getDate() - (27 - i));
    return d.toISOString().split('T')[0];
  });

  // Calculate intensity (count of completions) per day
  const completionsPerDay = {};
  completions.forEach(c => {
    completionsPerDay[c.completed_date] = (completionsPerDay[c.completed_date] || 0) + 1;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Morning, Founder!</h1>
        <p>Let's make today count.</p>
      </header>

      {/* Goal Selection Tabs */}
      <div className={styles.goalSection}>
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
            placeholder="Create a new Macro Goal..." 
            className={styles.goalInput}
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
          />
          <button type="submit" className={styles.addGoalBtn}>+</button>
        </form>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}

      {!loading && activeGoalId && (
        <>
          {/* Daily Dashboard */}
          <section className={styles.habitsList}>
            <h2>Daily Habits for this Goal</h2>

            {/* Add New Habit */}
            <form className={styles.addHabitForm} onSubmit={addHabit}>
              <input 
                type="text" 
                placeholder="Add a new daily habit..." 
                className={styles.habitInput}
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
              />
              <button type="submit" className={styles.addBtn}>Add</button>
            </form>
            
            {habits.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No habits for this goal yet.</p>
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

      {!loading && goals.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>Create your first Macro Goal above to get started!</p>
      )}
    </div>
  );
}
