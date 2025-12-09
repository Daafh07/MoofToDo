import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { supabase } from '../lib/supabase';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

type TabKey = 'home' | 'tasks' | 'agenda' | 'reminders' | 'notes';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  is_done: boolean;
};

type Reminder = {
  id: string;
  title: string;
  remind_at: string | null;
  is_done: boolean;
  created_at?: string;
};

type AgendaEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location?: string | null;
  description?: string | null;
  created_at?: string;
};

type NoteFolder = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  notes_count?: number | null;
  created_at?: string;
};

type Note = {
  id: string;
  folder_id: string;
  title: string;
  content?: string | null;
  color?: string | null;
  created_at?: string;
};

const ACCENT = '#4f3dff';
const BACKGROUND = '#f6f7fb';
const CARD = '#ffffff';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const isWeb = Platform.OS === 'web';

const NAV_ITEMS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'tasks', label: 'Tasks', icon: 'list-outline' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar-outline' },
  { key: 'reminders', label: 'Reminders', icon: 'notifications-outline' },
  { key: 'notes', label: 'Notes', icon: 'document-outline' },
];

const toIsoOrNull = (value: string | null | undefined) => {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const ensureProfile = async (userId: string | undefined, name?: string | null, email?: string | null) => {
  if (!userId) return;
  await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: name || email || 'Moof user',
      },
      { onConflict: 'id' },
    )
    .select();
};

export default function PlannerScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setBootstrapLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    bootstrap();

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    if (data?.user) {
      await ensureProfile(data.user.id, (data.user.user_metadata as any)?.full_name, email);
    }
    setAuthBusy(false);
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) setAuthError(error.message);
    if (data?.user) {
      await ensureProfile(data.user.id, name, email);
    }
    setAuthBusy(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (bootstrapLoading) {
    return <Splash />;
  }

  if (!session) {
    return (
      <AuthScreen busy={authBusy} error={authError} onSignIn={handleSignIn} onSignUp={handleSignUp} />
    );
  }

  return <AppShell session={session} onSignOut={handleSignOut} />;
}

function Splash() {
  return (
    <SafeAreaView style={[styles.centered, { backgroundColor: BACKGROUND }]}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={{ marginTop: 12, color: MUTED }}>Bezig met laden...</Text>
    </SafeAreaView>
  );
}

type AuthScreenProps = {
  busy: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
};

function AuthScreen({ busy, error, onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (mode === 'login') {
      await onSignIn(email.trim(), password);
    } else {
      await onSignUp(name.trim() || 'Moof user', email.trim(), password);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BACKGROUND }}>
      <StatusBar style="dark" />
      <View style={styles.authWrapper}>
        <View style={styles.authBrand}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoLetter}>M</Text>
          </View>
          <Text style={styles.brandTitle}>MoofTodo</Text>
          <Text style={styles.brandSubtitle}>Your daily assistant</Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.authTabs}>
            <Pressable
              onPress={() => setMode('login')}
              style={[
                styles.authTab,
                mode === 'login' && { backgroundColor: ACCENT, shadowOpacity: 0.2 },
              ]}>
              <Text style={[styles.authTabText, mode === 'login' && { color: '#fff' }]}>
                Login
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('signup')}
              style={[
                styles.authTab,
                mode === 'signup' && { backgroundColor: ACCENT, shadowOpacity: 0.2 },
              ]}>
              <Text style={[styles.authTabText, mode === 'signup' && { color: '#fff' }]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          {mode === 'signup' && (
            <LabeledInput
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              icon="person-outline"
            />
          )}

          <LabeledInput
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <LabeledInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            icon="lock-closed-outline"
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            disabled={busy}
            onPress={handleSubmit}
            style={[styles.primaryButton, busy && { opacity: 0.6 }]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Login' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.authFooterText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <Text
              onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
              style={{ color: ACCENT, fontWeight: '600' }}>
              {mode === 'login' ? 'Sign up here' : 'Login here'}
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

type AppShellProps = {
  session: Session;
  onSignOut: () => Promise<void>;
};

function AppShell({ session, onSignOut }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderInput, setReminderInput] = useState('');
  const [reminderWhen, setReminderWhen] = useState('');
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [eventInput, setEventInput] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [folderInput, setFolderInput] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesListLoading, setNotesListLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteColor, setNoteColor] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const userName =
    (session?.user?.user_metadata as { full_name?: string })?.full_name ??
    session?.user?.email?.split('@')[0] ??
    'Moof user';
  const firstName = useMemo(() => {
    if (!userName) return 'Moof user';
    return userName.split(' ')[0] || userName;
  }, [userName]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.is_done).length,
    [tasks],
  );
  const activeCount = tasks.length - completedCount;

  const fetchTasks = async () => {
    setTasksLoading(true);
    setTasksError(null);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setTasksError(error.message);
    } else {
      setTasks((data as Task[]) ?? []);
    }
    setTasksLoading(false);
  };

  const addTask = async () => {
    if (!taskInput.trim()) return;
    setTasksLoading(true);

    const { error } = await supabase.from('tasks').insert({
      title: taskInput.trim(),
      user_id: session?.user?.id,
    });

    if (error) {
      setTasksError(error.message);
      setTasksLoading(false);
    } else {
      setTaskInput('');
      fetchTasks();
    }
  };

  const toggleTask = async (task: Task) => {
    setTasksLoading(true);
    const { error } = await supabase
      .from('tasks')
      .update({ is_done: !task.is_done })
      .eq('id', task.id);

    if (error) {
      setTasksError(error.message);
      setTasksLoading(false);
    } else {
      fetchTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasksLoading(true);
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      setTasksError(error.message);
      setTasksLoading(false);
    } else {
      fetchTasks();
    }
  };

  const fetchReminders = async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('remind_at', { ascending: true });

    if (error) {
      setRemindersError(error.message);
    } else {
      setReminders((data as Reminder[]) ?? []);
    }
    setRemindersLoading(false);
  };

  const addReminder = async () => {
    if (!reminderInput.trim()) return;
    setRemindersLoading(true);
    const payload = {
      title: reminderInput.trim(),
      remind_at: toIsoOrNull(reminderWhen) ?? new Date().toISOString(),
      user_id: session?.user?.id,
    };
    const { error } = await supabase.from('reminders').insert(payload);
    if (error) {
      setRemindersError(error.message);
      setRemindersLoading(false);
    } else {
      setReminderInput('');
      setReminderWhen('');
      fetchReminders();
    }
  };

  const toggleReminder = async (reminder: Reminder) => {
    setRemindersLoading(true);
    const { error } = await supabase
      .from('reminders')
      .update({ is_done: !reminder.is_done })
      .eq('id', reminder.id);
    if (error) {
      setRemindersError(error.message);
      setRemindersLoading(false);
    } else {
      fetchReminders();
    }
  };

  const deleteReminder = async (id: string) => {
    setRemindersLoading(true);
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) {
      setRemindersError(error.message);
      setRemindersLoading(false);
    } else {
      fetchReminders();
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    const { data, error } = await supabase
      .from('agenda_events')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) {
      setEventsError(error.message);
    } else {
      setEvents((data as AgendaEvent[]) ?? []);
    }
    setEventsLoading(false);
  };

  const addEvent = async () => {
    if (!eventInput.trim()) return;
    setEventsLoading(true);
    const payload = {
      title: eventInput.trim(),
      starts_at: toIsoOrNull(eventStart) ?? new Date().toISOString(),
      ends_at: toIsoOrNull(eventEnd),
      location: eventLocation || null,
      user_id: session?.user?.id,
    };
    const { error } = await supabase.from('agenda_events').insert(payload);
    if (error) {
      setEventsError(error.message);
      setEventsLoading(false);
    } else {
      setEventInput('');
      setEventStart('');
      setEventEnd('');
      setEventLocation('');
      fetchEvents();
    }
  };

  const deleteEvent = async (id: string) => {
    setEventsLoading(true);
    const { error } = await supabase.from('agenda_events').delete().eq('id', id);
    if (error) {
      setEventsError(error.message);
      setEventsLoading(false);
    } else {
      fetchEvents();
    }
  };

  const fetchFolders = async () => {
    setNotesLoading(true);
    setNotesError(null);
    const { data, error } = await supabase
      .from('note_folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setNotesError(error.message);
    } else {
      setFolders((data as NoteFolder[]) ?? []);
      if (!selectedFolderId && data && data.length > 0) {
        setSelectedFolderId(data[0].id);
      }
    }
    setNotesLoading(false);
  };

  const addFolder = async (nameOverride?: string, iconOverride?: string | null, colorOverride?: string | null) => {
    const name = (nameOverride ?? folderInput).trim();
    if (!name) return;
    setNotesLoading(true);
    const payload = {
      name,
      user_id: session?.user?.id,
      color: colorOverride ?? null,
      icon: iconOverride ?? null,
    };
    const { error } = await supabase.from('note_folders').insert(payload);
    if (error) {
      setNotesError(error.message);
      setNotesLoading(false);
    } else {
      setFolderInput('');
      fetchFolders();
    }
  };

  const fetchNotes = async () => {
    setNotesListLoading(true);
    setNotesError(null);
    const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
    if (error) {
      setNotesError(error.message);
    } else {
      setNotes((data as Note[]) ?? []);
    }
    setNotesListLoading(false);
  };

  const updateNote = async () => {
    if (!editingNote) return;
    if (!noteTitle.trim()) return;
    setNotesListLoading(true);
    const payload = {
      title: noteTitle.trim(),
      content: noteBody.trim() || null,
      color: noteColor,
    };
    const { error } = await supabase.from('notes').update(payload).eq('id', editingNote.id);
    if (error) {
      setNotesError(error.message);
    } else {
      setNoteModalOpen(false);
      setEditingNote(null);
      setNoteTitle('');
      setNoteBody('');
      setNoteColor(null);
      fetchNotes();
    }
    setNotesListLoading(false);
  };

  const addNote = async () => {
    const targetFolder = selectedFolderId || null;
    if (!noteTitle.trim()) return;
    setNotesListLoading(true);
    const payload = {
      title: noteTitle.trim(),
      content: noteBody.trim() || null,
      folder_id: targetFolder,
      user_id: session?.user?.id,
      color: noteColor,
    };
    const { error } = await supabase.from('notes').insert(payload);
    if (error) {
      setNotesError(error.message);
    } else {
      setNoteTitle('');
      setNoteBody('');
      setNoteColor(null);
      setEditingNote(null);
      setNoteModalOpen(false);
      fetchNotes();
    }
    setNotesListLoading(false);
  };

  useEffect(() => {
    fetchTasks();
    fetchReminders();
    fetchEvents();
    fetchFolders();
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeView
            name={firstName}
            tasks={tasks}
            activeCount={activeCount}
            completedCount={completedCount}
            reminders={reminders}
            events={events}
            folders={folders}
            isDesktop={isDesktop}
          />
        );
      case 'tasks':
        return (
          <TasksView
            tasks={tasks}
            loading={tasksLoading}
            error={tasksError}
            value={taskInput}
            onChangeValue={setTaskInput}
            onAdd={addTask}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onRefresh={fetchTasks}
          />
        );
      case 'agenda':
        return (
          <AgendaView
            events={events}
            loading={eventsLoading}
            error={eventsError}
            value={eventInput}
            startValue={eventStart}
            endValue={eventEnd}
            locationValue={eventLocation}
            onChangeValue={setEventInput}
            onChangeStart={setEventStart}
            onChangeEnd={setEventEnd}
            onChangeLocation={setEventLocation}
            onAdd={addEvent}
            onDelete={deleteEvent}
            onRefresh={fetchEvents}
          />
        );
      case 'reminders':
        return (
          <RemindersView
            reminders={reminders}
            loading={remindersLoading}
            error={remindersError}
            value={reminderInput}
            whenValue={reminderWhen}
            onChangeValue={setReminderInput}
            onChangeWhen={setReminderWhen}
            onAdd={addReminder}
            onToggle={toggleReminder}
            onDelete={deleteReminder}
            onRefresh={fetchReminders}
          />
        );
      case 'notes':
        return (
          <NotesView
            folders={folders}
            notes={notes}
            loading={notesLoading}
            notesLoading={notesListLoading}
            error={notesError}
            value={folderInput}
            onChangeValue={setFolderInput}
            onAdd={addFolder}
            onRefresh={() => {
              fetchFolders();
              fetchNotes();
            }}
            selectedFolderId={selectedFolderId}
            onSelectFolder={(id) => {
              setSelectedFolderId(id);
              fetchNotes();
            }}
            onOpenNoteModal={() => {
              setEditingNote(null);
              setNoteTitle('');
              setNoteBody('');
              setNoteColor('#4f46e5');
              setNoteModalOpen(true);
            }}
            onOpenExistingNote={(note) => {
              setEditingNote(note);
              setNoteTitle(note.title);
              setNoteBody(note.content || '');
              setNoteColor(note.color || '#4f46e5');
              setNoteModalOpen(true);
            }}
            onCloseNoteModal={() => {
              setNoteModalOpen(false);
              setEditingNote(null);
            }}
            noteModalOpen={noteModalOpen}
            noteTitle={noteTitle}
            noteBody={noteBody}
            noteColor={noteColor}
            editingNote={editingNote}
            onChangeNoteTitle={setNoteTitle}
            onChangeNoteBody={setNoteBody}
            onChangeNoteColor={setNoteColor}
            onCreateNote={() => {
              if (editingNote) {
                updateNote();
              } else {
                addNote();
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BACKGROUND }}>
      <StatusBar style="dark" />
      <Animated.View
        entering={isWeb ? undefined : FadeIn.duration(180)}
        exiting={isWeb ? undefined : FadeOut.duration(120)}
        style={[styles.shell, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {isDesktop ? (
          <Sidebar
            name={userName}
            email={session?.user?.email ?? ''}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onSignOut={onSignOut}
          />
        ) : (
          <MobileHeader name={userName} email={session?.user?.email ?? ''} onSignOut={onSignOut} />
        )}

        <View style={{ flex: 1, paddingHorizontal: isDesktop ? 24 : 18, paddingTop: 20 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: isDesktop ? 24 : 90 }}>
            {renderContent()}
          </ScrollView>
        </View>
      </Animated.View>
      {!isDesktop && (
        <BottomNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onAddTask={addTask}
          canAddTask={Boolean(taskInput.trim())}
        />
      )}
    </SafeAreaView>
  );
}

type SidebarProps = {
  name: string;
  email: string;
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onSignOut: () => void;
};

function Sidebar({ name, email, activeTab, onSelectTab, onSignOut }: SidebarProps) {
  return (
    <View style={styles.sidebar}>
      <View>
        <Text style={styles.sidebarBrand}>MoofTodo</Text>
        <Text style={styles.sidebarSub}>Your daily assistant</Text>
      </View>

      <View style={{ marginTop: 32 }}>
        {NAV_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onSelectTab(item.key)}
            style={[
              styles.navItem,
              activeTab === item.key && {
                backgroundColor: ACCENT,
                shadowOpacity: 0.2,
              },
            ]}>
            <Ionicons
              name={item.icon}
              size={22}
              color={activeTab === item.key ? '#fff' : '#3f4a5a'}
            />
            <Text style={[styles.navText, activeTab === item.key && { color: '#fff' }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sidebarFooter}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerName}>{name}</Text>
          <Text style={styles.footerEmail}>{email}</Text>
        </View>
        <Pressable onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#334155" />
        </Pressable>
      </View>
    </View>
  );
}

type MobileHeaderProps = {
  name: string;
  email: string;
  onSignOut: () => void;
};

function MobileHeader({ name, email, onSignOut }: MobileHeaderProps) {
  return (
    <View style={styles.mobileHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[styles.logoBadge, { marginBottom: 0 }]}>
          <Text style={styles.logoLetter}>M</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>MoofTodo</Text>
          <Text style={[styles.brandSubtitle, { fontSize: 12 }]}>{email}</Text>
        </View>
      </View>
      <Pressable onPress={onSignOut} style={styles.iconButton}>
        <Ionicons name="log-out-outline" size={18} color="#1f2937" />
      </Pressable>
    </View>
  );
}

type BottomNavProps = {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onAddTask: () => void;
  canAddTask: boolean;
};

function BottomNav({ activeTab, onSelectTab, onAddTask, canAddTask }: BottomNavProps) {
  return (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onSelectTab(item.key)}
          style={[styles.bottomNavItem, activeTab === item.key && { opacity: 1 }]}>
          <Ionicons
            name={item.icon}
            size={20}
            color={activeTab === item.key ? ACCENT : '#4b5563'}
          />
          <Text style={[styles.bottomNavText, activeTab === item.key && { color: ACCENT }]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        disabled={!canAddTask}
        onPress={onAddTask}
        style={[styles.fab, !canAddTask && { opacity: 0.6 }]}>
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

type HomeViewProps = {
  name: string;
  tasks: Task[];
  activeCount: number;
  completedCount: number;
  reminders: Reminder[];
  events: AgendaEvent[];
  folders: NoteFolder[];
  isDesktop: boolean;
};

function HomeView({
  name,
  tasks,
  activeCount,
  completedCount,
  reminders,
  events,
  folders,
  isDesktop,
}: HomeViewProps) {
  const today = useMemo(() => new Date(), []);
  const week = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1);
    return Array.from({ length: 7 }).map((_, idx) => {
      const day = new Date(start);
      day.setDate(start.getDate() + idx);
      return {
        label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx],
        date: day.getDate(),
        isToday: day.toDateString() === today.toDateString(),
      };
    });
  }, [today]);

  const nextEvent = useMemo(() => {
    const sorted = [...events].filter((e) => e.starts_at).sort((a, b) => {
      return new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime();
    });
    return sorted[0];
  }, [events]);

  const totalNotes = useMemo(() => {
    if (!folders?.length) return 0;
    const sum = folders.reduce((acc, folder) => acc + (folder.notes_count ?? 0), 0);
    return sum || folders.length;
  }, [folders]);

  return (
    <Animated.View
      style={{ gap: 18 }}
      entering={isWeb ? undefined : FadeInDown.duration(200)}
      layout={isWeb ? undefined : Layout.springify()}>
      <Animated.View
        style={styles.pageHeader}
        entering={isWeb ? undefined : FadeInDown.delay(40).duration(200)}>
        <View>
          <Text style={styles.heading}>Good Afternoon, {name}</Text>
          <Text style={styles.subheading}>
            {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cloud-outline" size={16} color={MUTED} />
            <Text style={styles.metaText}>10°C • Cloudy</Text>
          </View>
        </View>
        <Pressable style={styles.iconButton}>
          <Ionicons name="search-outline" size={18} color="#1f2937" />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={styles.card}
        entering={isWeb ? undefined : FadeInDown.delay(80).duration(220)}
        layout={isWeb ? undefined : Layout.springify()}>
        {isDesktop ? (
          <View style={styles.weekRow}>
            {week.map((day) => (
              <View
                key={`${day.label}-${day.date}`}
                style={[
                  styles.weekPill,
                  day.isToday && { backgroundColor: ACCENT, shadowOpacity: 0.2 },
                ]}>
                <Text style={[styles.weekLabel, day.isToday && { color: '#fff' }]}>{day.label}</Text>
                <Text style={[styles.weekDate, day.isToday && { color: '#fff' }]}>
                  {day.date}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {week.map((day) => (
              <View
                key={`${day.label}-${day.date}`}
                style={[
                  styles.weekPill,
                  day.isToday && { backgroundColor: ACCENT, shadowOpacity: 0.2 },
                ]}>
                <Text style={[styles.weekLabel, day.isToday && { color: '#fff' }]}>{day.label}</Text>
                <Text style={[styles.weekDate, day.isToday && { color: '#fff' }]}>
                  {day.date}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      <View style={[styles.twoColumn, !isDesktop && { flexDirection: 'column' }]}>
        <Animated.View
          entering={isWeb ? undefined : FadeInDown.delay(120).duration(220)}
          layout={isWeb ? undefined : Layout.springify()}
          style={[styles.card, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Your Day at a Glance</Text>
          <View style={{ gap: 12, marginTop: 12 }}>
            <MiniStat
              icon="checkmark-done-circle-outline"
              label="Tasks"
              value={`${completedCount}/${tasks.length}`}
              hint={`${activeCount} active`}
            />
            <MiniStat
              icon="calendar-outline"
              label="Next Event"
              value={nextEvent?.title ?? 'No upcoming events'}
              hint={
                nextEvent?.starts_at
                  ? new Date(nextEvent.starts_at).toLocaleString()
                  : undefined
              }
            />
            <MiniStat icon="time-outline" label="Focus Time Today" value="0 min" />
          </View>
        </Animated.View>

        <Animated.View
          entering={isWeb ? undefined : FadeInDown.delay(150).duration(220)}
          layout={isWeb ? undefined : Layout.springify()}
          style={{ width: isDesktop ? 280 : '100%', gap: 12 }}>
          <BubbleCard
            icon="checkbox-outline"
            color="#c5cafe"
            title="Tasks"
            subtitle={`${completedCount} of ${tasks.length || 0} completed`}
          />
          <BubbleCard
            icon="calendar-outline"
            color="#fce7f3"
            title="Agenda"
            subtitle={`${events.length} events`}
          />
          <BubbleCard
            icon="notifications-outline"
            color="#ffe4e6"
            title="Reminders"
            subtitle={`${reminders.filter((r) => !r.is_done).length} active`}
          />
          <BubbleCard
            icon="chatbubble-ellipses-outline"
            color="#fef3c7"
            title="Notes"
            subtitle={`${totalNotes} item${totalNotes === 1 ? '' : 's'}`}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

type TasksViewProps = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  value: string;
  onChangeValue: (value: string) => void;
  onAdd: () => void;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
};

function TasksView({
  tasks,
  loading,
  error,
  value,
  onChangeValue,
  onAdd,
  onToggle,
  onDelete,
  onRefresh,
}: TasksViewProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const filtered = tasks.filter((task) => {
    if (filter === 'completed') return task.is_done;
    if (filter === 'active') return !task.is_done;
    return true;
  });

  return (
    <View style={{ gap: 16 }}>
      <Animated.View style={styles.pageHeader} entering={isWeb ? undefined : FadeInDown.duration(200)}>
        <View>
          <Text style={styles.heading}>Tasks</Text>
          <Text style={styles.subheading}>{tasks.length} tasks remaining</Text>
        </View>
        <TouchableOpacity style={styles.ghostButton} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={16} color="#1f2937" />
          <Text style={styles.ghostButtonText}>Refresh</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={isWeb ? undefined : FadeInDown.delay(60).duration(220)}
        layout={isWeb ? undefined : Layout.springify()}
        style={[styles.card, { gap: 12 }]}>
        <View style={styles.inputRow}>
          <Ionicons name="add" size={18} color={ACCENT} />
          <TextInput
            placeholder="Add a new task..."
            value={value}
            onChangeText={onChangeValue}
            style={styles.textInput}
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            onPress={onAdd}
            disabled={!value.trim() || loading}
            style={[styles.primaryButton, { paddingHorizontal: 18, height: 44 }]}>
            <Text style={styles.primaryButtonText}>Add Task</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipsRow}>
          {['all', 'active', 'completed'].map((type) => (
            <Pressable
              key={type}
              onPress={() => setFilter(type as 'all' | 'active' | 'completed')}
              style={[
                styles.chip,
                filter === type && { backgroundColor: '#e5e7ff', borderColor: 'transparent' },
              ]}>
              <Text style={[styles.chipText, filter === type && { color: ACCENT, fontWeight: '700' }]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={ACCENT} />
        ) : (
          <Animated.FlatList
            entering={isWeb ? undefined : FadeInDown.delay(90)}
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Animated.View
                entering={isWeb ? undefined : FadeInDown.duration(180)}
                layout={isWeb ? undefined : Layout.springify()}
                style={styles.taskCard}>
                <Pressable onPress={() => onToggle(item)} style={styles.taskToggle}>
                  <Ionicons
                    name={item.is_done ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.is_done ? ACCENT : '#4b5563'}
                  />
                  <View>
                    <Text
                      style={[
                        styles.taskTitle,
                        item.is_done && { textDecorationLine: 'line-through', color: MUTED },
                      ]}>
                      {item.title}
                    </Text>
                    <Text style={styles.taskSubtext}>{item.description ?? 'No description'}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => onDelete(item.id)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </Animated.View>
            )}
            ListEmptyComponent={
              <Animated.View style={styles.emptyState} entering={isWeb ? undefined : FadeInDown.duration(200)}>
                <Ionicons name="sparkles-outline" size={32} color={ACCENT} />
                <Text style={styles.emptyText}>No tasks yet</Text>
                <Text style={styles.metaText}>Add your first task to get started.</Text>
              </Animated.View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

type AgendaViewProps = {
  events: AgendaEvent[];
  loading: boolean;
  error: string | null;
  value: string;
  startValue: string;
  endValue: string;
  locationValue: string;
  onChangeValue: (v: string) => void;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onChangeLocation: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
};

function AgendaView({
  events,
  loading,
  error,
  value,
  startValue,
  endValue,
  locationValue,
  onChangeValue,
  onChangeStart,
  onChangeEnd,
  onChangeLocation,
  onAdd,
  onDelete,
  onRefresh,
}: AgendaViewProps) {
  return (
    <View style={{ gap: 16 }}>
      <Animated.View style={styles.pageHeader} entering={isWeb ? undefined : FadeInDown.duration(200)}>
        <View>
          <Text style={styles.heading}>Agenda</Text>
          <Text style={styles.subheading}>{events.length} events</Text>
        </View>
        <TouchableOpacity style={styles.ghostButton} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={16} color="#1f2937" />
          <Text style={styles.ghostButtonText}>Refresh</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={isWeb ? undefined : FadeInDown.delay(60).duration(220)}
        layout={isWeb ? undefined : Layout.springify()}
        style={[styles.card, { gap: 12 }]}>
        <View style={{ gap: 10 }}>
          <Text style={styles.inputLabel}>New event</Text>
          <View style={styles.inputRow}>
            <Ionicons name="calendar-outline" size={18} color={ACCENT} />
            <TextInput
              placeholder="Title"
              value={value}
              onChangeText={onChangeValue}
              style={styles.textInput}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="time-outline" size={18} color={ACCENT} />
            <TextInput
              placeholder="Starts at (e.g. 2025-01-01 14:00)"
              value={startValue}
              onChangeText={onChangeStart}
              style={styles.textInput}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="time-outline" size={18} color={ACCENT} />
            <TextInput
              placeholder="Ends at (optional)"
              value={endValue}
              onChangeText={onChangeEnd}
              style={styles.textInput}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputRow}>
            <Ionicons name="location-outline" size={18} color={ACCENT} />
            <TextInput
              placeholder="Location (optional)"
              value={locationValue}
              onChangeText={onChangeLocation}
              style={styles.textInput}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <TouchableOpacity
            onPress={onAdd}
            disabled={!value.trim() || loading}
            style={[styles.primaryButton, { alignSelf: 'flex-start', paddingHorizontal: 18 }]}>
            <Text style={styles.primaryButtonText}>Add Event</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={ACCENT} />
        ) : (
          <Animated.FlatList
            entering={isWeb ? undefined : FadeInDown.delay(90)}
            scrollEnabled={false}
            data={events}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Animated.View
                entering={isWeb ? undefined : FadeInDown.duration(180)}
                layout={isWeb ? undefined : Layout.springify()}
                style={styles.taskCard}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.taskTitle}>{item.title}</Text>
                  <Text style={styles.metaText}>
                    {item.starts_at
                      ? new Date(item.starts_at).toLocaleString()
                      : 'No start time'}
                  </Text>
                  {item.location ? <Text style={styles.metaText}>{item.location}</Text> : null}
                </View>
                <Pressable onPress={() => onDelete(item.id)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </Animated.View>
            )}
            ListEmptyComponent={
              <Animated.View style={styles.emptyState} entering={isWeb ? undefined : FadeInDown.duration(200)}>
                <Ionicons name="calendar-outline" size={32} color={ACCENT} />
                <Text style={styles.emptyText}>No events yet</Text>
                <Text style={styles.metaText}>Add your next meeting or class.</Text>
              </Animated.View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

type RemindersViewProps = {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  value: string;
  whenValue: string;
  onChangeValue: (v: string) => void;
  onChangeWhen: (v: string) => void;
  onAdd: () => void;
  onToggle: (r: Reminder) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
};

function RemindersView({
  reminders,
  loading,
  error,
  value,
  whenValue,
  onChangeValue,
  onChangeWhen,
  onAdd,
  onToggle,
  onDelete,
  onRefresh,
}: RemindersViewProps) {
  return (
    <View style={{ gap: 16 }}>
      <Animated.View style={styles.pageHeader} entering={isWeb ? undefined : FadeInDown.duration(200)}>
        <View>
          <Text style={styles.heading}>Reminders</Text>
          <Text style={styles.subheading}>
            {reminders.filter((r) => !r.is_done).length} active reminders
          </Text>
        </View>
        <TouchableOpacity style={styles.ghostButton} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={16} color="#1f2937" />
          <Text style={styles.ghostButtonText}>Refresh</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={isWeb ? undefined : FadeInDown.delay(60).duration(220)}
        layout={isWeb ? undefined : Layout.springify()}
        style={[styles.card, { gap: 12 }]}>
        <View style={styles.inputRow}>
          <Ionicons name="add" size={18} color={ACCENT} />
          <TextInput
            placeholder="Add a reminder..."
            value={value}
            onChangeText={onChangeValue}
            style={styles.textInput}
            placeholderTextColor="#9ca3af"
          />
        </View>
        <View style={styles.inputRow}>
          <Ionicons name="time-outline" size={18} color={ACCENT} />
          <TextInput
            placeholder="When? (e.g. 2025-01-01 09:00) optional"
            value={whenValue}
            onChangeText={onChangeWhen}
            style={styles.textInput}
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            onPress={onAdd}
            disabled={!value.trim() || loading}
            style={[styles.primaryButton, { paddingHorizontal: 18, height: 44 }]}>
            <Text style={styles.primaryButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={ACCENT} />
        ) : (
          <Animated.FlatList
            entering={isWeb ? undefined : FadeInDown.delay(90)}
            scrollEnabled={false}
            data={reminders}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Animated.View
                entering={isWeb ? undefined : FadeInDown.duration(180)}
                layout={isWeb ? undefined : Layout.springify()}
                style={styles.taskCard}>
                <Pressable onPress={() => onToggle(item)} style={styles.taskToggle}>
                  <Ionicons
                    name={item.is_done ? 'notifications' : 'notifications-outline'}
                    size={20}
                    color={item.is_done ? ACCENT : '#4b5563'}
                  />
                  <View>
                    <Text
                      style={[
                        styles.taskTitle,
                        item.is_done && { textDecorationLine: 'line-through', color: MUTED },
                      ]}>
                      {item.title}
                    </Text>
                    <Text style={styles.metaText}>
                      {item.remind_at
                        ? new Date(item.remind_at).toLocaleString()
                        : 'No time set'}
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => onDelete(item.id)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </Animated.View>
            )}
            ListEmptyComponent={
              <Animated.View style={styles.emptyState} entering={isWeb ? undefined : FadeInDown.duration(200)}>
                <Ionicons name="notifications-outline" size={32} color={ACCENT} />
                <Text style={styles.emptyText}>No reminders yet</Text>
                <Text style={styles.metaText}>Add one to stay on track.</Text>
              </Animated.View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

type NotesViewProps = {
  folders: NoteFolder[];
  loading: boolean;
  notesLoading: boolean;
  error: string | null;
  value: string;
  onChangeValue: (v: string) => void;
  onAdd: (nameOverride?: string, iconOverride?: string | null, colorOverride?: string | null) => void;
  onRefresh: () => void;
  notes: Note[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onOpenNoteModal: () => void;
  onOpenExistingNote: (note: Note) => void;
  onCloseNoteModal: () => void;
  noteModalOpen: boolean;
  noteTitle: string;
  noteBody: string;
  noteColor: string | null;
  editingNote: Note | null;
  onChangeNoteTitle: (v: string) => void;
  onChangeNoteBody: (v: string) => void;
  onChangeNoteColor: (v: string) => void;
  onCreateNote: () => void;
};

function NotesView({
  folders,
  loading,
  notesLoading,
  error,
  value,
  onChangeValue,
  onAdd,
  onRefresh,
  notes,
  selectedFolderId,
  onSelectFolder,
  onOpenNoteModal,
  onOpenExistingNote,
  onCloseNoteModal,
  noteModalOpen,
  noteTitle,
  noteBody,
  noteColor,
  editingNote,
  onChangeNoteTitle,
  onChangeNoteBody,
  onChangeNoteColor,
  onCreateNote,
}: NotesViewProps) {
  const totalNotes = folders.reduce((acc, f) => acc + (f.notes_count ?? 0), 0);
  const looseNotes = notes.filter((n) => !n.folder_id);
  const filteredNotes = selectedFolderId ? notes.filter((n) => n.folder_id === selectedFolderId) : looseNotes;
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayName, setOverlayName] = useState('');
  const [overlayColor, setOverlayColor] = useState<string | null>(null);
  const [overlayIcon, setOverlayIcon] = useState<string | null>('folder');
  const colors = [
    '#4f46e5',
    '#6366f1',
    '#8b5cf6',
    '#0ea5e9',
    '#06b6d4',
    '#10b981',
    '#22c55e',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#f43f5e',
    '#14b8a6',
  ];
  const icons: (keyof typeof Ionicons.glyphMap)[] = [
    'folder',
    'document-text',
    'code-slash',
    'book',
    'briefcase',
    'star',
    'pencil',
    'school',
    'musical-notes',
    'planet',
    'heart',
    'flash',
  ];
  const [richLib, setRichLib] = useState<{ RichEditor: any; RichToolbar: any; actions: any } | null>(null);
  const richRef = useRef<any | null>(null);
  const webEditorRef = useRef<HTMLDivElement | null>(null);
  const webSelection = useRef<Range | null>(null);
  const isClient = typeof window !== 'undefined';
  const toPlainText = (html?: string | null) =>
    html ? html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

  useEffect(() => {
    if (!isClient || isWeb) return; // skip on web (WebView unsupported)
    let mounted = true;
    import('react-native-pell-rich-editor')
      .then((mod) => {
        if (mounted) setRichLib(mod);
      })
      .catch((err) => console.warn('Failed to load rich editor', err));
    return () => {
      mounted = false;
    };
  }, [isClient]);

  useEffect(() => {
    if (!isWeb) return;
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const editorEl = webEditorRef.current;
      if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
        webSelection.current = range.cloneRange();
      }
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  useEffect(() => {
    if (noteModalOpen) {
      if (!isWeb && richRef.current) {
        richRef.current.setContentHTML(noteBody || '');
      }
      if (isWeb && webEditorRef.current) {
        webEditorRef.current.innerHTML = noteBody || '';
      }
    }
  }, [noteModalOpen, noteBody, isWeb]);

  const runWebCommand = (cmd: string, value?: string) => {
    if (!isWeb) return;
    try {
      const editor = webEditorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (webSelection.current && sel) {
        sel.removeAllRanges();
        sel.addRange(webSelection.current);
      }
      document.execCommand(cmd, false, value);
      const html = editor.innerHTML ?? '';
      onChangeNoteBody(html);
    } catch (e) {
      console.warn('web command failed', cmd, e);
    }
  };

  // Dedicated editor screen (no overlay)
  if (noteModalOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f4f6', padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View>
            <Text style={styles.heroTitle}>{editingNote ? 'Edit Note' : 'New Note'}</Text>
            <Text style={styles.subheading}>Volledige editor (Docs-stijl).</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.ghostButton, { paddingHorizontal: 14, height: 44 }]} onPress={onCloseNoteModal}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!noteTitle.trim() || notesLoading}
              style={[styles.primaryButton, { paddingHorizontal: 20, height: 44 }]}
              onPress={onCreateNote}>
              <Text style={styles.primaryButtonText}>{editingNote ? 'Save Changes' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ gap: 12 }}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              placeholder="Document title..."
              value={noteTitle}
              onChangeText={onChangeNoteTitle}
              style={[styles.textInput, styles.overlayInput, { fontSize: 24, fontWeight: '800', backgroundColor: '#fff' }]}
              placeholderTextColor="#9ca3af"
              autoFocus
            />
          </View>

          <View style={{ marginTop: 14, marginBottom: 10 }}>
            <Text style={styles.inputLabel}>Toolbar</Text>
            {isWeb ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                <Pressable style={styles.toolbarButton} onPress={() => runWebCommand('bold')}>
                  <Text style={styles.toolbarButtonText}>B</Text>
                </Pressable>
                <Pressable style={styles.toolbarButton} onPress={() => runWebCommand('italic')}>
                  <Text style={[styles.toolbarButtonText, { fontStyle: 'italic' }]}>i</Text>
                </Pressable>
                <Pressable style={styles.toolbarButton} onPress={() => runWebCommand('underline')}>
                  <Text style={[styles.toolbarButtonText, { textDecorationLine: 'underline' }]}>U</Text>
                </Pressable>
                <Pressable style={styles.toolbarButton} onPress={() => runWebCommand('insertUnorderedList')}>
                  <Text style={styles.toolbarButtonText}>• List</Text>
                </Pressable>
                <Pressable style={styles.toolbarButton} onPress={() => runWebCommand('formatBlock', 'h1')}>
                  <Text style={styles.toolbarButtonText}>H1</Text>
                </Pressable>
                <Pressable style={styles.toolbarButton} onPress={() => runWebCommand('formatBlock', 'h2')}>
                  <Text style={styles.toolbarButtonText}>H2</Text>
                </Pressable>
              </ScrollView>
            ) : richLib?.RichToolbar && richLib?.actions ? (
              <richLib.RichToolbar
                editor={richRef as any}
                actions={[
                  richLib.actions.undo,
                  richLib.actions.redo,
                  richLib.actions.setBold,
                  richLib.actions.setItalic,
                  richLib.actions.setUnderline,
                  richLib.actions.heading1,
                  richLib.actions.heading2,
                  richLib.actions.insertOrderedList,
                  richLib.actions.insertBulletsList,
                  richLib.actions.alignLeft,
                  richLib.actions.alignCenter,
                  richLib.actions.alignRight,
                  richLib.actions.setStrikethrough,
                  richLib.actions.foreColor,
                  richLib.actions.hiliteColor,
                ]}
                selectedIconTint={ACCENT}
                iconTint="#1f2937"
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                }}
              />
            ) : (
              <Text style={styles.metaText}>Loading editor toolbar…</Text>
            )}
          </View>

          <View style={{ gap: 10 }}>
            <Text style={styles.inputLabel}>Content</Text>
            <View style={[styles.docPage, { minHeight: 420, padding: 0 }]}>
              {isWeb ? (
                <div
                  ref={webEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => onChangeNoteBody((e.currentTarget as HTMLDivElement).innerHTML)}
                  dangerouslySetInnerHTML={{ __html: noteBody }}
                  style={{
                    minHeight: 400,
                    padding: 12,
                    backgroundColor: '#fff',
                    borderRadius: 24,
                    outline: 'none',
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: '#111827',
                    cursor: 'text',
                  }}
                />
              ) : richLib?.RichEditor ? (
                <richLib.RichEditor
                  ref={richRef as any}
                  initialContentHTML={noteBody}
                  placeholder="Start writing zoals Google Docs..."
                  onChange={(html: string) => onChangeNoteBody(html || '')}
                  editorStyle={{
                    backgroundColor: '#fff',
                    color: '#111827',
                    placeholderColor: '#9ca3af',
                  }}
                  style={{ minHeight: 400, borderRadius: 24, padding: 12 }}
                />
              ) : (
                <Text style={{ padding: 12, color: '#6b7280' }}>
                  Editor wordt geladen...
                </Text>
              )}
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorRow}>
              {colors.map((c) => (
                <Pressable
                  key={`note-color-${c}`}
                  onPress={() => onChangeNoteColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    noteColor === c && { borderWidth: 2, borderColor: '#111827' },
                  ]}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Animated.View
        entering={isWeb ? undefined : FadeInDown.duration(220)}
        layout={isWeb ? undefined : Layout.springify()}
        style={[styles.card, styles.notesHero]}>
        <View style={{ gap: 8, flex: 1 }}>
          <Text style={styles.heroTitle}>All Notes</Text>
          <Text style={styles.subheading}>
            {totalNotes} note{totalNotes === 1 ? '' : 's'} • {folders.length} folder{folders.length === 1 ? '' : 's'}
          </Text>
          <View style={[styles.pill, { backgroundColor: '#e5e7ff', alignSelf: 'flex-start', marginTop: 10 }]}>
            <Ionicons name="folder-outline" size={18} color={ACCENT} />
            <Text style={[styles.pillText, { color: ACCENT, fontSize: 16 }]}>All Notes</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable style={[styles.iconButton, { height: 42, width: 42 }]} onPress={onRefresh}>
            <Ionicons name="search-outline" size={18} color="#1f2937" />
          </Pressable>
          <TouchableOpacity
            style={[styles.primaryButton, { height: 42, paddingHorizontal: 14 }]}
            onPress={() => {
              setOverlayName(value.trim() || '');
              setOverlayColor(colors[0]);
              setOverlayIcon(icons[0]);
              setShowOverlay(true);
            }}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Add Folder</Text>
          </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { height: 42, paddingHorizontal: 14 }]}
              onPress={onOpenNoteModal}>
              <Ionicons name="document-text" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>New Note</Text>
            </TouchableOpacity>
          </View>
      </Animated.View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        <Pressable
          onPress={() => onSelectFolder(null)}
          style={[
            styles.pill,
            { backgroundColor: selectedFolderId ? '#e5e7eb' : '#e5e7ff' },
          ]}>
          <Ionicons name="albums-outline" size={16} color={selectedFolderId ? '#1f2937' : ACCENT} />
          <Text style={[styles.pillText, { color: selectedFolderId ? '#1f2937' : ACCENT }]}>
            All ({looseNotes.length})
          </Text>
        </Pressable>
        {folders.map((folder) => (
          <Pressable
            key={folder.id}
            onPress={() => onSelectFolder(folder.id)}
            style={[
              styles.pill,
              {
                backgroundColor: selectedFolderId === folder.id ? '#e5e7ff' : '#f1f5f9',
              },
            ]}>
            <Ionicons name={(folder.icon as any) || 'folder'} size={16} color={selectedFolderId === folder.id ? ACCENT : '#1f2937'} />
            <Text style={[styles.pillText, { color: '#1f2937' }]}>{folder.name}</Text>
            <Text style={[styles.pillBadge, { backgroundColor: '#e5e7eb' }]}>
              {notes.filter((n) => n.folder_id === folder.id).length}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={ACCENT} />
      ) : (
        <View style={{ gap: 20 }}>
          {folders.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {folders.map((folder) => (
                <Animated.View
                  entering={isWeb ? undefined : FadeInDown.duration(220)}
                  layout={isWeb ? undefined : Layout.springify()}
                  key={folder.id}
                  style={[
                    styles.folderCard,
                    { backgroundColor: folder.color || '#e3e7f1' },
                  ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={(folder.icon as any) || 'document-text-outline'} size={16} color="#111827" />
                    <Text style={styles.folderTitle}>{folder.name}</Text>
                  </View>
                  <Text style={styles.metaText}>
                    {notes.filter((n) => n.folder_id === folder.id).length} notes
                  </Text>
                  <Text style={[styles.metaText, { marginTop: 'auto' }]}>
                    {folder.created_at
                      ? new Date(folder.created_at).toLocaleDateString()
                      : 'Today'}
                  </Text>
                </Animated.View>
              ))}
            </View>
          ) : (
            <Animated.View
              entering={isWeb ? undefined : FadeInDown.duration(220)}
              style={[styles.card, { alignItems: 'center', gap: 8, paddingVertical: 28 }]}>
              <Text style={styles.heroTitle}>No folders yet</Text>
              <Text style={styles.metaText}>Create your first folder to get organized.</Text>
            </Animated.View>
          )}

          {notesLoading ? (
            <ActivityIndicator color={ACCENT} />
          ) : filteredNotes.length ? (
            <View style={{ gap: 10 }}>
              {filteredNotes.map((note) => (
                <Animated.View
                  key={note.id}
                  entering={isWeb ? undefined : FadeInDown.duration(180)}
                  layout={isWeb ? undefined : Layout.springify()}
                  style={[styles.taskCard, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={styles.taskTitle}>{note.title}</Text>
                  <Text numberOfLines={2} style={styles.metaText}>
                    {toPlainText(note.content) || 'No content'}
                  </Text>
                  <Text style={[styles.metaText, { marginTop: 6 }]}>
                    {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
                  </Text>
                  <Pressable
                    style={[styles.iconButton, { marginTop: 8 }]}
                    onPress={() => onOpenExistingNote(note)}>
                    <Ionicons name="create-outline" size={16} color="#1f2937" />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ) : (
            <Animated.View style={styles.emptyState} entering={isWeb ? undefined : FadeInDown.duration(200)}>
              <Ionicons name="document-outline" size={28} color={ACCENT} />
              <Text style={styles.emptyText}>No notes yet</Text>
              <Text style={styles.metaText}>Add a note to get started.</Text>
            </Animated.View>
          )}
        </View>
      )}
      {showOverlay && (
        <Animated.View
          entering={isWeb ? undefined : FadeIn.duration(160)}
          exiting={isWeb ? undefined : FadeOut.duration(120)}
          style={styles.overlay}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setShowOverlay(false)} />
          <Animated.View
            entering={isWeb ? undefined : ZoomIn.duration(200)}
            exiting={isWeb ? undefined : ZoomOut.duration(140)}
            style={styles.overlayCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.heroTitle}>New Folder</Text>
                <Text style={styles.subheading}>Name, icon en kleur in één stap.</Text>
              </View>
              <Pressable onPress={() => setShowOverlay(false)}>
                <Ionicons name="close" size={22} color="#1f2937" />
              </Pressable>
            </View>

            <View style={{ gap: 8, marginTop: 10 }}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                placeholder="Folder name..."
                value={overlayName}
                onChangeText={setOverlayName}
                style={[styles.textInput, styles.overlayInput]}
                placeholderTextColor="#9ca3af"
                autoFocus
              />
            </View>

            <Text style={styles.inputLabel}>Icon</Text>
            <View style={styles.iconRow}>
              {icons.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setOverlayIcon(icon)}
                  style={[
                    styles.iconPill,
                    overlayIcon === icon && { backgroundColor: '#eef2ff', borderColor: ACCENT },
                  ]}>
                  <Ionicons name={icon} size={20} color={overlayIcon === icon ? ACCENT : '#1f2937'} />
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorRow}>
              {colors.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setOverlayColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    overlayColor === c && { borderWidth: 2, borderColor: '#111827' },
                  ]}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.ghostButton, { paddingHorizontal: 14, height: 42 }]} onPress={() => setShowOverlay(false)}>
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!overlayName.trim() || loading}
                style={[styles.primaryButton, { paddingHorizontal: 18, height: 42 }]}
                onPress={() => {
                  const name = overlayName.trim();
                  if (!name) return;
                  onAdd(name, overlayIcon, overlayColor);
                  setOverlayName('');
                  setOverlayColor(colors[0]);
                  setOverlayIcon(icons[0]);
                  setShowOverlay(false);
                }}>
                <Text style={styles.primaryButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

type LabeledInputProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

function LabeledInput({ label, icon, ...rest }: LabeledInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {icon ? <Ionicons name={icon} size={18} color="#9ca3af" /> : null}
        <TextInput
          style={styles.textInput}
          placeholderTextColor="#9ca3af"
          selectionColor={ACCENT}
          {...rest}
        />
      </View>
    </View>
  );
}

type MiniStatProps = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; hint?: string };

function MiniStat({ icon, label, value, hint }: MiniStatProps) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={ACCENT} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {hint ? <Text style={styles.metaText}>{hint}</Text> : null}
      </View>
    </View>
  );
}

type BubbleCardProps = { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; subtitle: string };

function BubbleCard({ icon, color, title, subtitle }: BubbleCardProps) {
  return (
    <View style={[styles.bubbleCard, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#4b5563" />
      <View>
        <Text style={styles.bubbleTitle}>{title}</Text>
        <Text style={styles.metaText}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  sidebar: {
    width: 260,
    padding: 20,
    backgroundColor: CARD,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    justifyContent: 'space-between',
  },
  sidebarBrand: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  sidebarSub: {
    color: MUTED,
    marginTop: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: '#f7f8fb',
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  navText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338ca',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
  },
  footerName: {
    fontWeight: '700',
    color: '#111827',
  },
  footerEmail: {
    color: MUTED,
    fontSize: 12,
  },
  authWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 24,
  },
  authBrand: {
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    backgroundColor: ACCENT,
    height: 68,
    width: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338ca',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 16,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  brandSubtitle: {
    color: MUTED,
    textAlign: 'center',
  },
  authCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: CARD,
    padding: 22,
    borderRadius: 20,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: '#f2f4f8',
    borderRadius: 16,
    padding: 6,
    gap: 8,
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#4338ca',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 12,
    shadowOpacity: 0,
  },
  authTabText: {
    fontWeight: '700',
    color: '#1f2937',
  },
  inputLabel: {
    fontWeight: '600',
    color: '#111827',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#4338ca',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  authFooterText: {
    textAlign: 'center',
    color: '#4b5563',
    marginTop: 6,
  },
  errorText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  mobileHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subheading: {
    color: MUTED,
    marginTop: 4,
  },
  metaText: {
    color: MUTED,
    fontSize: 13,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekPill: {
    width: 42,
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    shadowColor: '#4338ca',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
  },
  weekLabel: {
    color: MUTED,
    fontWeight: '600',
  },
  weekDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
  },
  statIcon: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: MUTED,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  bubbleCard: {
    padding: 14,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
  },
  bubbleTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ghostButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  chipText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  taskToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  taskSubtext: {
    color: MUTED,
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  bottomNavItem: {
    alignItems: 'center',
    gap: 4,
    opacity: 0.8,
  },
  bottomNavText: {
    fontSize: 12,
    color: '#4b5563',
  },
  fab: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338ca',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
  },
  folderCard: {
    height: 150,
    minWidth: 180,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 12,
  },
  folderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  pillText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    color: '#111827',
    fontWeight: '700',
  },
  notesHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 50,
  },
  overlayBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 26,
  },
  overlayInput: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconPill: {
    height: 38,
    width: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    height: 28,
    width: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toolbarButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toolbarButtonText: {
    fontWeight: '700',
    color: '#1f2937',
  },
  docPage: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
  },
});
