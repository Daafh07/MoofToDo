import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  owner_id?: string;
  user_id?: string;
};

type NoteCollaborator = {
  id: string;
  note_id: string;
  user_id: string;
  permission: 'view' | 'edit';
  invited_by: string;
  created_at?: string;
  user_email?: string;
  user_name?: string;
};

type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
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
  const [sharedFolders, setSharedFolders] = useState<NoteFolder[]>([]);
  const [folderInput, setFolderInput] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [notesListLoading, setNotesListLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteColor, setNoteColor] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const hasRestoredDraft = useRef(false);

  // Collaboration state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingNote, setSharingNote] = useState<Note | null>(null);
  const [collaborators, setCollaborators] = useState<NoteCollaborator[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<UserProfile[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [notesSearchQuery, setNotesSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showFolderOverlay, setShowFolderOverlay] = useState(false);
  const [folderOverlayName, setFolderOverlayName] = useState('');
  const [folderOverlayColor, setFolderOverlayColor] = useState<string | null>(null);
  const [folderOverlayIcon, setFolderOverlayIcon] = useState<string | null>('folder-outline');
  const [alertMessage, setAlertMessage] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null);
  const [showEditFolderOverlay, setShowEditFolderOverlay] = useState(false);
  const [deleteFolderConfirmOpen, setDeleteFolderConfirmOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<NoteFolder | null>(null);
  const [sharingFolder, setSharingFolder] = useState<NoteFolder | null>(null);
  const [showShareFolderModal, setShowShareFolderModal] = useState(false);
  const [folderCollaborators, setFolderCollaborators] = useState<any[]>([]);

  // Auto-save to localStorage on web - ONLY after restore completes!
  useEffect(() => {
    if (!isWeb) return;

    // Wait for restore to complete before enabling auto-save
    if (!hasRestoredDraft.current) {
      console.log('⏭️ Skipping auto-save - waiting for restore');
      return;
    }

    console.log('💾 AUTO-SAVE running, noteModalOpen:', noteModalOpen);

    // Save current note state to localStorage
    if (noteModalOpen) {
      const draftData = {
        noteModalOpen,
        noteTitle,
        noteBody,
        noteColor,
        editingNote: editingNote ? { id: editingNote.id, title: editingNote.title } : null,
        timestamp: Date.now(),
      };
      console.log('💾 Saving to localStorage:', draftData);
      localStorage.setItem('note-draft', JSON.stringify(draftData));
      localStorage.setItem('was-in-note', 'true');
      console.log('✅ Saved! Check localStorage now');
    } else {
      console.log('🗑️ Modal closed, clearing localStorage');
      // Clear draft when modal is closed
      localStorage.removeItem('note-draft');
      localStorage.removeItem('was-in-note');
    }
  }, [noteModalOpen, noteTitle, noteBody, noteColor, editingNote, isWeb]);

  // Restore draft IMMEDIATELY on page load - don't wait for notes
  useEffect(() => {
    console.log('🟢 RESTORE useEffect running, isWeb:', isWeb);

    if (!isWeb) {
      console.log('❌ Not web, skipping');
      return;
    }

    if (hasRestoredDraft.current) {
      console.log('⚠️ Already restored, skipping');
      return;
    }

    console.log('🔍 Checking for draft...');
    const wasInNote = localStorage.getItem('was-in-note');
    const savedDraft = localStorage.getItem('note-draft');

    console.log('📝 wasInNote:', wasInNote);
    console.log('📝 savedDraft exists:', !!savedDraft);

    if (wasInNote && savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        console.log('✅ Draft parsed:', draft);

        // Check if draft is recent (within last 24 hours)
        const isRecent = draft.timestamp && (Date.now() - draft.timestamp < 24 * 60 * 60 * 1000);
        console.log('⏰ Is recent:', isRecent, 'timestamp:', draft.timestamp);

        if (isRecent) {
          console.log('🚀 Restoring note modal NOW...');
          // Restore immediately
          setNoteTitle(draft.noteTitle || '');
          setNoteBody(draft.noteBody || '');
          setNoteColor(draft.noteColor);

          // Use setTimeout to ensure it happens after render
          setTimeout(() => {
            console.log('🎯 Opening modal...');
            setNoteModalOpen(true);
          }, 50);

          // Mark as restored
          hasRestoredDraft.current = true;
        }
      } catch (e) {
        console.error('❌ Failed to restore draft', e);
      }
    } else {
      console.log('⚠️ No draft to restore');
    }
  }, []);

  // Restore editing note after notes load
  useEffect(() => {
    if (!isWeb || notesLoading || !hasRestoredDraft.current) return;

    const savedDraft = localStorage.getItem('note-draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);

        // If editing an existing note, find and set it
        if (draft.editingNote?.id && notes.length > 0) {
          const existingNote = notes.find(n => n.id === draft.editingNote.id);
          if (existingNote) {
            setEditingNote(existingNote);
          }
        }
      } catch (e) {
        console.error('Failed to restore editing note', e);
      }
    }
  }, [isWeb, notesLoading, notes]);

  // Auto-save to database when editing an existing note
  useEffect(() => {
    if (!editingNote) return; // Only auto-save when editing existing note
    if (!noteTitle.trim()) return; // Don't save if title is empty

    console.log('🔄 Auto-save triggered for note:', editingNote.id);
    setAutoSaveStatus('saving');

    // Debounce: wait 2 seconds after last change before saving
    const timeoutId = setTimeout(async () => {
      try {
        console.log('💾 Auto-saving note to database...');
        const { error } = await supabase
          .from('notes')
          .update({
            title: noteTitle.trim(),
            content: noteBody.trim() || null,
            color: noteColor,
          })
          .eq('id', editingNote.id);

        if (error) {
          console.error('❌ Auto-save failed:', error);
          setAutoSaveStatus('idle');
        } else {
          console.log('✅ Auto-saved successfully!');
          setAutoSaveStatus('saved');
          // Reset to idle after 2 seconds
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        }
      } catch (e) {
        console.error('❌ Auto-save error:', e);
        setAutoSaveStatus('idle');
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [noteTitle, noteBody, noteColor, editingNote]);

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

    // Fetch own folders
    const { data: ownFoldersData, error: ownError } = await supabase
      .from('note_folders')
      .select('*')
      .eq('user_id', session?.user?.id)
      .order('created_at', { ascending: false });

    // Fetch shared folders via folder_collaborators
    console.log('🔍 Fetching shared folders for user:', session?.user?.id);
    const { data: collaboratorData, error: collaboratorError } = await supabase
      .from('folder_collaborators')
      .select('folder_id')
      .eq('user_id', session?.user?.id);

    if (collaboratorError) {
      console.error('❌ Error fetching folder_collaborators:', collaboratorError);
    }
    console.log('📊 Collaborator data:', collaboratorData);

    let sharedFoldersData: NoteFolder[] = [];
    if (collaboratorData && collaboratorData.length > 0) {
      const folderIds = collaboratorData.map(c => c.folder_id);
      console.log('📂 Fetching folders with IDs:', folderIds);
      const { data: sharedData, error: sharedError } = await supabase
        .from('note_folders')
        .select('*')
        .in('id', folderIds)
        .order('created_at', { ascending: false });

      if (sharedError) {
        console.error('❌ Error fetching shared folders:', sharedError);
      }
      console.log('📁 Shared folders data:', sharedData);

      sharedFoldersData = (sharedData as NoteFolder[]) ?? [];
    }

    console.log('📁 Folders:', { own: ownFoldersData?.length ?? 0, shared: sharedFoldersData.length });

    if (ownError) {
      setNotesError(ownError.message);
    } else {
      setFolders((ownFoldersData as NoteFolder[]) ?? []);
      setSharedFolders(sharedFoldersData);
      if (!selectedFolderId && ownFoldersData && ownFoldersData.length > 0) {
        setSelectedFolderId(ownFoldersData[0].id);
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

  const updateFolder = async (folderId: string, name: string, icon: string | null, color: string | null) => {
    if (!name.trim()) return;
    setNotesLoading(true);
    const { error } = await supabase
      .from('note_folders')
      .update({ name: name.trim(), icon, color })
      .eq('id', folderId);

    if (error) {
      setAlertMessage({
        title: 'Update Failed',
        message: error.message,
        type: 'error',
      });
      setNotesLoading(false);
    } else {
      setAlertMessage({
        title: 'Success',
        message: 'Folder updated successfully!',
        type: 'success',
      });
      fetchFolders();
    }
  };

  const deleteFolder = async (folderId: string) => {
    setNotesLoading(true);

    // First, check if there are notes in this folder
    const { data: notesInFolder } = await supabase
      .from('notes')
      .select('id')
      .eq('folder_id', folderId);

    if (notesInFolder && notesInFolder.length > 0) {
      // Move notes to "no folder" (set folder_id to null)
      await supabase
        .from('notes')
        .update({ folder_id: null })
        .eq('folder_id', folderId);
    }

    // Delete the folder
    const { error } = await supabase
      .from('note_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      setAlertMessage({
        title: 'Delete Failed',
        message: error.message,
        type: 'error',
      });
      setNotesLoading(false);
    } else {
      setAlertMessage({
        title: 'Success',
        message: 'Folder deleted successfully!',
        type: 'success',
      });
      // Reset selected folder if we deleted the active one
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      fetchFolders();
      fetchNotes();
    }
  };

  const shareFolderWithUser = async (folderId: string, userId: string, permission: 'view' | 'edit' = 'edit') => {
    if (!session?.user?.id) {
      setAlertMessage({
        title: 'Not Logged In',
        message: 'You must be logged in to share folders',
        type: 'error',
      });
      return;
    }

    if (userId === session.user.id) {
      setAlertMessage({
        title: 'Invalid Action',
        message: 'You cannot share a folder with yourself',
        type: 'warning',
      });
      return;
    }

    setShareLoading(true);
    try {
      // Check if already shared
      const { data: existing, error: checkError } = await supabase
        .from('folder_collaborators')
        .select('*')
        .eq('folder_id', folderId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        setAlertMessage({
          title: 'Already Shared',
          message: 'This folder is already shared with this user',
          type: 'info',
        });
        setShareLoading(false);
        return;
      }

      // Add folder collaborator
      console.log('➕ Adding folder collaborator:', { folderId, userId, permission });
      const { error: folderError } = await supabase.from('folder_collaborators').insert({
        folder_id: folderId,
        user_id: userId,
        permission,
        invited_by: session.user.id,
      });

      if (folderError) {
        console.error('❌ Failed to add folder collaborator:', folderError);
        setAlertMessage({
          title: 'Failed to Share Folder',
          message: folderError.message,
          type: 'error',
        });
        setShareLoading(false);
        return;
      }

      console.log('✅ Folder collaborator added successfully');

      // Get all notes in this folder
      const { data: notesInFolder } = await supabase
        .from('notes')
        .select('id')
        .eq('folder_id', folderId);

      // Share all existing notes in the folder with this user
      if (notesInFolder && notesInFolder.length > 0) {
        const noteCollaborators = notesInFolder.map(note => ({
          note_id: note.id,
          user_id: userId,
          permission,
          invited_by: session.user.id,
        }));

        await supabase.from('note_collaborators').insert(noteCollaborators);
      }

      await fetchFolderCollaborators(folderId);
      await fetchFolders();
      await fetchNotes();

      // Clear search
      setUserSearchQuery('');
      setSearchedUsers([]);

      setAlertMessage({
        title: 'Success',
        message: `Folder shared successfully! ${notesInFolder?.length || 0} notes also shared.`,
        type: 'success',
      });
    } catch (e) {
      console.error('❌ Share folder failed', e);
      setAlertMessage({
        title: 'Failed to Share',
        message: 'An unexpected error occurred',
        type: 'error',
      });
    }
    setShareLoading(false);
  };

  const fetchFolderCollaborators = async (folderId: string) => {
    try {
      console.log('🔍 Fetching folder collaborators for:', folderId);
      const { data: collaboratorData, error: collaboratorError } = await supabase
        .from('folder_collaborators')
        .select('*')
        .eq('folder_id', folderId);

      if (collaboratorError) {
        console.error('❌ Error fetching folder collaborators:', collaboratorError);
        return;
      }

      console.log('📊 Folder collaborators data:', collaboratorData);

      if (!collaboratorData || collaboratorData.length === 0) {
        setFolderCollaborators([]);
        console.log('✅ No folder collaborators found');
        return;
      }

      // Fetch user profiles for each collaborator
      const userIds = collaboratorData.map((c: any) => c.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
        setFolderCollaborators(collaboratorData);
        return;
      }

      // Merge collaborator data with profile data
      const enrichedCollaborators = collaboratorData.map((collab: any) => {
        const profile = profiles?.find((p: any) => p.id === collab.user_id);
        return {
          ...collab,
          user_email: profile?.email,
          profiles: profile,
        };
      });

      setFolderCollaborators(enrichedCollaborators);
      console.log('✅ Set folder collaborators:', enrichedCollaborators.length);
    } catch (e) {
      console.error('❌ Fetch folder collaborators failed', e);
    }
  };

  const removeFolderCollaborator = async (collaboratorId: string, folderId: string) => {
    setShareLoading(true);
    try {
      const { error } = await supabase
        .from('folder_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) {
        setAlertMessage({
          title: 'Failed to Remove',
          message: error.message,
          type: 'error',
        });
      } else {
        await fetchFolderCollaborators(folderId);
        await fetchFolders();
        setAlertMessage({
          title: 'Success',
          message: 'Collaborator removed from folder',
          type: 'success',
        });
      }
    } catch (e) {
      console.error('❌ Remove folder collaborator failed', e);
    }
    setShareLoading(false);
  };

  const fetchNotes = async () => {
    setNotesListLoading(true);
    setNotesError(null);

    try {
      console.log('📚 Fetching notes for user:', session?.user?.id);

      // Get ALL folder_collaborator entries to determine which folders are shared
      const { data: allFolderCollabData } = await supabase
        .from('folder_collaborators')
        .select('folder_id, user_id');

      // Collect all unique folder IDs that have at least one collaborator entry
      // These are the shared folders
      const sharedFolderIds = new Set(
        (allFolderCollabData || []).map(c => c.folder_id)
      );

      console.log('📂 All folder collaborators:', allFolderCollabData);
      console.log('📂 Shared folder IDs:', Array.from(sharedFolderIds));

      // Fetch own notes EXCLUDING notes in shared folders
      const { data: ownNotesData, error: ownError } = await supabase
        .from('notes')
        .select('*')
        .or(`owner_id.eq.${session?.user?.id},user_id.eq.${session?.user?.id}`)
        .order('created_at', { ascending: false });

      // Filter out notes that are in shared folders
      const filteredOwnNotes = (ownNotesData ?? []).filter(
        (note: any) => !note.folder_id || !sharedFolderIds.has(note.folder_id)
      );

      console.log('📝 Own notes:', {
        total: ownNotesData?.length,
        filtered: filteredOwnNotes.length,
        error: ownError
      });

      // Fetch notes shared with this user via note_collaborators
      const { data: collaboratorData, error: collabError } = await supabase
        .from('note_collaborators')
        .select('note_id')
        .eq('user_id', session?.user?.id);

      console.log('🤝 Collaborator entries:', { count: collaboratorData?.length, error: collabError });

      let sharedNotesData: any[] = [];
      if (collaboratorData && collaboratorData.length > 0) {
        const noteIds = collaboratorData.map(c => c.note_id);
        console.log('📌 Fetching notes with IDs:', noteIds);

        const { data: sharedData, error: sharedError } = await supabase
          .from('notes')
          .select('*')
          .in('id', noteIds)
          .order('created_at', { ascending: false });

        console.log('📤 Shared notes:', { count: sharedData?.length, error: sharedError });
        sharedNotesData = sharedData ?? [];
      }

      // Also fetch ALL notes from shared folders (for both owner and collaborators)
      if (sharedFolderIds.size > 0) {
        const folderIdsArray = Array.from(sharedFolderIds);
        console.log('📂 Fetching notes from shared folders:', folderIdsArray);

        const { data: folderNotesData, error: folderNotesError } = await supabase
          .from('notes')
          .select('*')
          .in('folder_id', folderIdsArray)
          .order('created_at', { ascending: false });

        console.log('📁 Notes from shared folders:', { count: folderNotesData?.length, error: folderNotesError });

        if (folderNotesData && folderNotesData.length > 0) {
          // Merge with existing shared notes, avoiding duplicates
          const existingNoteIds = new Set(sharedNotesData.map(n => n.id));
          const newNotes = folderNotesData.filter(n => !existingNoteIds.has(n.id));
          sharedNotesData = [...sharedNotesData, ...newNotes];
        }
      }

      if (ownError) {
        setNotesError(ownError.message);
        setNotesListLoading(false);
        return;
      }

      console.log('📊 Final split:', { own: filteredOwnNotes.length, shared: sharedNotesData.length });
      console.log('📋 Shared notes data:', sharedNotesData);

      setNotes(filteredOwnNotes as Note[]);
      setSharedNotes(sharedNotesData as Note[]);

      console.log('✅ State updated - notes and sharedNotes set');
    } catch (e) {
      console.error('❌ Fetch notes failed', e);
      setNotesError('Failed to load notes');
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
    console.log('💾 Updating note:', editingNote.id, payload);
    const { error } = await supabase.from('notes').update(payload).eq('id', editingNote.id);
    if (error) {
      console.error('❌ Update note error:', error);
      setNotesError(error.message);
    } else {
      console.log('✅ Note updated successfully');
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
      owner_id: session?.user?.id,
      color: noteColor,
    };
    const { data: newNote, error } = await supabase.from('notes').insert(payload).select().single();
    if (error) {
      setNotesError(error.message);
    } else {
      // If the note is in a shared folder, automatically add folder collaborators to the note
      if (targetFolder && newNote) {
        const { data: folderCollabs } = await supabase
          .from('folder_collaborators')
          .select('user_id, permission')
          .eq('folder_id', targetFolder);

        if (folderCollabs && folderCollabs.length > 0) {
          const noteCollaborators = folderCollabs.map(collab => ({
            note_id: newNote.id,
            user_id: collab.user_id,
            permission: collab.permission,
            invited_by: session?.user?.id,
          }));

          await supabase.from('note_collaborators').insert(noteCollaborators);
          console.log(`✅ Auto-shared note with ${folderCollabs.length} folder collaborators`);
        }
      }

      setNoteTitle('');
      setNoteBody('');
      setNoteColor(null);
      setEditingNote(null);
      setNoteModalOpen(false);
      fetchNotes();
    }
    setNotesListLoading(false);
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (!error) {
        await fetchNotes();
      }
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  // Collaboration functions
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchedUsers([]);
      return;
    }
    setShareLoading(true);
    try {
      console.log('🔍 Searching for users with query:', query);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name')
        .ilike('email', `%${query}%`)
        .limit(5);

      console.log('👥 Search results:', data, 'Error:', error);

      if (error) {
        console.error('Search error:', error);
        setAlertMessage({
          title: 'Search Failed',
          message: error.message,
          type: 'error',
        });
      } else if (data) {
        console.log(`✅ Found ${data.length} users`);
        setSearchedUsers(data as UserProfile[]);
      }
    } catch (e) {
      console.error('User search failed', e);
      setAlertMessage({
        title: 'Search Failed',
        message: 'An unexpected error occurred',
        type: 'error',
      });
    }
    setShareLoading(false);
  };

  const fetchCollaborators = async (noteId: string) => {
    console.log('👥 Fetching collaborators for note:', noteId);
    try {
      // First, get the collaborator records
      const { data: collabData, error: collabError } = await supabase
        .from('note_collaborators')
        .select('*')
        .eq('note_id', noteId);

      console.log('👥 Collaborators raw data:', { data: collabData, error: collabError });

      if (collabError) {
        console.error('❌ Error fetching collaborators:', collabError);
        return;
      }

      if (!collabData || collabData.length === 0) {
        console.log('ℹ️ No collaborators found');
        setCollaborators([]);
        return;
      }

      // Then fetch the profile info for each collaborator
      const userIds = collabData.map((c: any) => c.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      console.log('👥 Profiles data:', { data: profileData, error: profileError });

      if (profileError) {
        console.error('❌ Error fetching profiles:', profileError);
        setCollaborators(collabData as NoteCollaborator[]);
        return;
      }

      // Combine the data
      const formatted = collabData.map((c: any) => {
        const profile = profileData?.find((p: any) => p.id === c.user_id);
        return {
          ...c,
          user_email: profile?.email,
          user_name: profile?.name,
        };
      });

      console.log('✅ Formatted collaborators:', formatted);
      setCollaborators(formatted);
    } catch (e) {
      console.error('❌ Fetch collaborators failed', e);
    }
  };

  const addCollaborator = async (noteId: string, userId: string, permission: 'view' | 'edit' = 'edit') => {
    if (!session?.user?.id) {
      console.error('❌ No session user ID');
      setAlertMessage({
        title: 'Not Logged In',
        message: 'You must be logged in to share notes',
        type: 'error',
      });
      return;
    }

    // Check if user is trying to add themselves
    if (userId === session.user.id) {
      console.warn('⚠️ Cannot add yourself as collaborator');
      setAlertMessage({
        title: 'Invalid Action',
        message: 'You cannot add yourself as a collaborator',
        type: 'warning',
      });
      return;
    }

    console.log('➕ Adding collaborator:', { noteId, userId, permission, invitedBy: session.user.id });
    setShareLoading(true);
    try {
      // First, verify that the current user owns this note
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('owner_id, user_id')
        .eq('id', noteId)
        .single();

      console.log('📝 Note ownership check:', { noteData, noteError });

      if (noteError) {
        console.error('❌ Error checking note ownership:', noteError);
        setAlertMessage({
          title: 'Verification Failed',
          message: 'Failed to verify note ownership',
          type: 'error',
        });
        setShareLoading(false);
        return;
      }

      const noteOwnerId = noteData.owner_id || noteData.user_id;
      if (noteOwnerId !== session.user.id) {
        console.error('❌ User is not the owner of this note');
        setAlertMessage({
          title: 'Permission Denied',
          message: 'You can only share notes that you own',
          type: 'error',
        });
        setShareLoading(false);
        return;
      }

      console.log('✅ Ownership verified, current user owns the note');

      // Check if collaborator already exists
      const { data: existing, error: checkError } = await supabase
        .from('note_collaborators')
        .select('id')
        .eq('note_id', noteId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is what we want
        console.error('❌ Error checking existing collaborator:', checkError);
        setAlertMessage({
          title: 'Check Failed',
          message: 'Failed to check existing collaborators',
          type: 'error',
        });
        setShareLoading(false);
        return;
      }

      if (existing) {
        console.warn('⚠️ Collaborator already exists');
        setAlertMessage({
          title: 'Already Added',
          message: 'This user is already a collaborator on this note',
          type: 'info',
        });
        setShareLoading(false);
        return;
      }

      // Add the collaborator
      const { data, error } = await supabase.from('note_collaborators').insert({
        note_id: noteId,
        user_id: userId,
        permission,
        invited_by: session.user.id,
      }).select();

      console.log('✅ Collaborator add result:', { data, error });

      if (error) {
        console.error('❌ Database error:', error);
        setAlertMessage({
          title: 'Failed to Add',
          message: error.message,
          type: 'error',
        });
      } else {
        console.log('✅ Collaborator added successfully');
        await fetchCollaborators(noteId);
        setUserSearchQuery('');
        setSearchedUsers([]);
        // Refresh notes to show the newly shared note for the collaborator
        await fetchNotes();
        setAlertMessage({
          title: 'Success',
          message: 'Collaborator added successfully!',
          type: 'success',
        });
      }
    } catch (e) {
      console.error('❌ Add collaborator failed', e);
      setAlertMessage({
        title: 'Failed to Add',
        message: 'An unexpected error occurred',
        type: 'error',
      });
    }
    setShareLoading(false);
  };

  const removeCollaborator = async (collaboratorId: string, noteId: string) => {
    try {
      const { error } = await supabase
        .from('note_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (!error) {
        await fetchCollaborators(noteId);
      }
    } catch (e) {
      console.error('Remove collaborator failed', e);
    }
  };

  const openShareModal = (note: Note) => {
    console.log('📂 Opening share modal for note:', { id: note.id, title: note.title });
    setSharingNote(note);
    setShareModalOpen(true);
    fetchCollaborators(note.id);
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setSharingNote(null);
    setCollaborators([]);
    setUserSearchQuery('');
    setSearchedUsers([]);
  };

  useEffect(() => {
    fetchTasks();
    fetchReminders();
    fetchEvents();
    fetchFolders();
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Realtime subscription for note_collaborators to refresh when user is added as collaborator
  useEffect(() => {
    if (!session?.user?.id) return;

    console.log('🔴 Setting up realtime subscription for note_collaborators');

    const channel = supabase
      .channel('note_collaborators_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_collaborators',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          console.log('🔔 Note collaborator change detected:', payload);
          // Refresh notes when user is added/removed as collaborator
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

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
            sharedFolders={sharedFolders}
            notes={notes}
            sharedNotes={sharedNotes}
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
            onDeleteNote={deleteNote}
            onShareNote={openShareModal}
            autoSaveStatus={autoSaveStatus}
            notesSearchQuery={notesSearchQuery}
            onNotesSearchChange={setNotesSearchQuery}
            deleteConfirmOpen={deleteConfirmOpen}
            setDeleteConfirmOpen={setDeleteConfirmOpen}
            noteToDelete={noteToDelete}
            setNoteToDelete={setNoteToDelete}
            showFolderOverlay={showFolderOverlay}
            setShowFolderOverlay={setShowFolderOverlay}
            folderOverlayName={folderOverlayName}
            setFolderOverlayName={setFolderOverlayName}
            folderOverlayColor={folderOverlayColor}
            setFolderOverlayColor={setFolderOverlayColor}
            folderOverlayIcon={folderOverlayIcon}
            setFolderOverlayIcon={setFolderOverlayIcon}
            editingFolder={editingFolder}
            setEditingFolder={setEditingFolder}
            showEditFolderOverlay={showEditFolderOverlay}
            setShowEditFolderOverlay={setShowEditFolderOverlay}
            currentUserId={session?.user?.id}
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

      <ShareModal
        visible={shareModalOpen}
        note={sharingNote}
        collaborators={collaborators}
        searchQuery={userSearchQuery}
        searchResults={searchedUsers}
        loading={shareLoading}
        onClose={closeShareModal}
        onSearchChange={(query) => {
          setUserSearchQuery(query);
          searchUsers(query);
        }}
        onAddCollaborator={(userId, permission) => {
          if (sharingNote) {
            addCollaborator(sharingNote.id, userId, permission);
          }
        }}
        onRemoveCollaborator={(collaboratorId) => {
          if (sharingNote) {
            removeCollaborator(collaboratorId, sharingNote.id);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <Animated.View
          entering={isWeb ? undefined : FadeIn.duration(200)}
          exiting={isWeb ? undefined : FadeOut.duration(150)}
          style={[
            styles.overlay,
            isWeb && {
              position: 'fixed' as any,
            },
          ]}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setDeleteConfirmOpen(false)} />
          <Animated.View
            entering={isWeb ? undefined : ZoomIn.duration(250).springify()}
            exiting={isWeb ? undefined : ZoomOut.duration(180)}
            style={styles.deleteConfirmCard}>
            {/* Icon */}
            <View style={styles.deleteConfirmIconBox}>
              <Ionicons name="trash" size={32} color="#ef4444" />
            </View>

            {/* Title & Message */}
            <Text style={styles.deleteConfirmTitle}>Delete Note?</Text>
            <Text style={styles.deleteConfirmMessage}>
              Are you sure you want to delete this note? This action cannot be undone.
            </Text>

            {/* Actions */}
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.deleteConfirmCancelButton}
                onPress={() => {
                  setDeleteConfirmOpen(false);
                  setNoteToDelete(null);
                }}>
                <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmDeleteButton}
                onPress={() => {
                  if (noteToDelete) {
                    deleteNote(noteToDelete);
                  }
                  setDeleteConfirmOpen(false);
                  setNoteToDelete(null);
                }}>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Create Folder Overlay */}
      {showFolderOverlay && (
        <Animated.View
          entering={isWeb ? undefined : FadeIn.duration(200)}
          exiting={isWeb ? undefined : FadeOut.duration(150)}
          style={[
            styles.overlay,
            isWeb && {
              position: 'fixed' as any,
            },
          ]}>
          <Pressable
            style={styles.overlayBackdrop}
            onPress={() => {
              setShowFolderOverlay(false);
              setFolderOverlayName('');
              setFolderOverlayColor(null);
              setFolderOverlayIcon('folder-outline');
            }}
          />
          <Animated.View
            entering={isWeb ? undefined : ZoomIn.duration(250).springify()}
            exiting={isWeb ? undefined : ZoomOut.duration(180)}
            style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Create Folder</Text>
            <Text style={styles.overlaySubtitle}>
              Organize your notes by creating a new folder
            </Text>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.overlayLabel}>Folder Name</Text>
              <TextInput
                style={styles.overlayInput}
                placeholder="Enter folder name..."
                placeholderTextColor="#9ca3af"
                value={folderOverlayName}
                onChangeText={setFolderOverlayName}
                autoFocus
              />
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.overlayLabel}>Icon</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ paddingRight: 12 }}>
                {[
                  'briefcase-outline',
                  'business-outline',
                  'calendar-outline',
                  'clipboard-outline',
                  'document-text-outline',
                  'folder-outline',
                  'laptop-outline',
                  'code-slash-outline',
                  'stats-chart-outline',
                  'trending-up-outline',
                  'school-outline',
                  'book-outline',
                  'library-outline',
                  'pencil-outline',
                  'calculator-outline',
                  'flask-outline',
                  'bulb-outline',
                  'newspaper-outline',
                  'home-outline',
                  'heart-outline',
                  'chatbubbles-outline',
                  'people-outline',
                  'cafe-outline',
                  'restaurant-outline',
                  'fitness-outline',
                  'bicycle-outline',
                  'game-controller-outline',
                  'musical-notes-outline',
                  'airplane-outline',
                  'camera-outline',
                  'basketball-outline',
                  'car-outline',
                  'sunny-outline',
                  'moon-outline',
                  'leaf-outline',
                  'earth-outline',
                  'star-outline',
                  'rocket-outline',
                  'cash-outline',
                  'card-outline',
                  'gift-outline',
                  'medkit-outline',
                ].map((ic) => (
                  <Pressable
                    key={ic}
                    onPress={() => setFolderOverlayIcon(ic)}
                    style={[
                      styles.iconPicker,
                      folderOverlayIcon === ic && styles.iconPickerSelected,
                    ]}>
                    <Ionicons
                      name={ic as any}
                      size={22}
                      color={folderOverlayIcon === ic ? '#fff' : '#6b7280'}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.overlayLabel}>Color</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  marginTop: 8,
                  gap: 8,
                }}>
                {[
                  '#4f46e5',
                  '#7c3aed',
                  '#2563eb',
                  '#0891b2',
                  '#059669',
                  '#65a30d',
                  '#ca8a04',
                  '#ea580c',
                  '#dc2626',
                  '#e11d48',
                  '#ec4899',
                  '#8b5cf6',
                  '#06b6d4',
                  '#10b981',
                  '#f59e0b',
                  '#6366f1',
                ].map((col) => (
                  <Pressable
                    key={col}
                    onPress={() => setFolderOverlayColor(col)}
                    style={[
                      styles.colorPicker,
                      { backgroundColor: col },
                      folderOverlayColor === col && styles.colorPickerSelected,
                    ]}>
                    {folderOverlayColor === col && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.overlayActions}>
              <TouchableOpacity
                style={styles.overlayCancelButton}
                onPress={() => {
                  setShowFolderOverlay(false);
                  setFolderOverlayName('');
                  setFolderOverlayColor(null);
                  setFolderOverlayIcon('folder-outline');
                }}>
                <Text style={styles.overlayCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.overlayCreateButton,
                  !folderOverlayName.trim() && styles.overlayCreateButtonDisabled,
                ]}
                disabled={!folderOverlayName.trim()}
                onPress={async () => {
                  await addFolder(folderOverlayName, folderOverlayIcon, folderOverlayColor);
                  setShowFolderOverlay(false);
                  setFolderOverlayName('');
                  setFolderOverlayColor(null);
                  setFolderOverlayIcon('folder-outline');
                }}>
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={!folderOverlayName.trim() ? '#9ca3af' : '#fff'}
                />
                <Text
                  style={[
                    styles.overlayCreateText,
                    !folderOverlayName.trim() && styles.overlayCreateTextDisabled,
                  ]}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Alert Message Overlay */}
      {alertMessage && (
        <Animated.View
          entering={isWeb ? undefined : FadeIn.duration(200)}
          exiting={isWeb ? undefined : FadeOut.duration(150)}
          style={[
            styles.overlay,
            isWeb && {
              position: 'fixed' as any,
            },
          ]}>
          <Pressable
            style={styles.overlayBackdrop}
            onPress={() => setAlertMessage(null)}
          />
          <Animated.View
            entering={isWeb ? undefined : ZoomIn.duration(250).springify()}
            exiting={isWeb ? undefined : ZoomOut.duration(180)}
            style={styles.alertCard}>
            {/* Icon */}
            <View
              style={[
                styles.alertIconBox,
                alertMessage.type === 'success' && styles.alertIconSuccess,
                alertMessage.type === 'error' && styles.alertIconError,
                alertMessage.type === 'warning' && styles.alertIconWarning,
                alertMessage.type === 'info' && styles.alertIconInfo,
              ]}>
              <Ionicons
                name={
                  alertMessage.type === 'success'
                    ? 'checkmark-circle'
                    : alertMessage.type === 'error'
                    ? 'close-circle'
                    : alertMessage.type === 'warning'
                    ? 'warning'
                    : 'information-circle'
                }
                size={32}
                color={
                  alertMessage.type === 'success'
                    ? '#10b981'
                    : alertMessage.type === 'error'
                    ? '#ef4444'
                    : alertMessage.type === 'warning'
                    ? '#f59e0b'
                    : '#3b82f6'
                }
              />
            </View>

            {/* Title & Message */}
            <Text style={styles.alertTitle}>{alertMessage.title}</Text>
            <Text style={styles.alertMessage}>{alertMessage.message}</Text>

            {/* OK Button */}
            <TouchableOpacity
              style={[
                styles.alertButton,
                alertMessage.type === 'success' && styles.alertButtonSuccess,
                alertMessage.type === 'error' && styles.alertButtonError,
                alertMessage.type === 'warning' && styles.alertButtonWarning,
                alertMessage.type === 'info' && styles.alertButtonInfo,
              ]}
              onPress={() => setAlertMessage(null)}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Edit Folder Overlay */}
      {showEditFolderOverlay && editingFolder && (
        <Animated.View
          entering={isWeb ? undefined : FadeIn.duration(200)}
          exiting={isWeb ? undefined : FadeOut.duration(150)}
          style={[
            styles.overlay,
            isWeb && {
              position: 'fixed' as any,
            },
          ]}>
          <Pressable
            style={styles.overlayBackdrop}
            onPress={() => {
              setShowEditFolderOverlay(false);
              setEditingFolder(null);
            }}
          />
          <Animated.View
            entering={isWeb ? undefined : ZoomIn.duration(250).springify()}
            exiting={isWeb ? undefined : ZoomOut.duration(180)}
            style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Edit Folder</Text>
            <Text style={styles.overlaySubtitle}>
              Update your folder details
            </Text>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.overlayLabel}>Folder Name</Text>
              <TextInput
                style={styles.overlayInput}
                placeholder="Enter folder name..."
                placeholderTextColor="#9ca3af"
                value={editingFolder.name}
                onChangeText={(text) => setEditingFolder({ ...editingFolder, name: text })}
                autoFocus
              />
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.overlayLabel}>Icon</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ paddingRight: 12 }}>
                {[
                  'briefcase-outline',
                  'business-outline',
                  'calendar-outline',
                  'clipboard-outline',
                  'document-text-outline',
                  'folder-outline',
                  'laptop-outline',
                  'code-slash-outline',
                  'stats-chart-outline',
                  'trending-up-outline',
                  'school-outline',
                  'book-outline',
                  'library-outline',
                  'pencil-outline',
                  'calculator-outline',
                  'flask-outline',
                  'bulb-outline',
                  'newspaper-outline',
                  'home-outline',
                  'heart-outline',
                  'chatbubbles-outline',
                  'people-outline',
                  'cafe-outline',
                  'restaurant-outline',
                  'fitness-outline',
                  'bicycle-outline',
                  'game-controller-outline',
                  'musical-notes-outline',
                  'airplane-outline',
                  'camera-outline',
                  'basketball-outline',
                  'car-outline',
                  'sunny-outline',
                  'moon-outline',
                  'leaf-outline',
                  'earth-outline',
                  'star-outline',
                  'rocket-outline',
                  'cash-outline',
                  'card-outline',
                  'gift-outline',
                  'medkit-outline',
                ].map((ic) => (
                  <Pressable
                    key={ic}
                    onPress={() => setEditingFolder({ ...editingFolder, icon: ic })}
                    style={[
                      styles.iconPicker,
                      editingFolder.icon === ic && styles.iconPickerSelected,
                    ]}>
                    <Ionicons
                      name={ic as any}
                      size={22}
                      color={editingFolder.icon === ic ? '#fff' : '#6b7280'}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.overlayLabel}>Color</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  marginTop: 8,
                  gap: 8,
                }}>
                {[
                  '#4f46e5',
                  '#7c3aed',
                  '#2563eb',
                  '#0891b2',
                  '#059669',
                  '#65a30d',
                  '#ca8a04',
                  '#ea580c',
                  '#dc2626',
                  '#e11d48',
                  '#ec4899',
                  '#8b5cf6',
                  '#06b6d4',
                  '#10b981',
                  '#f59e0b',
                  '#6366f1',
                ].map((col) => (
                  <Pressable
                    key={col}
                    onPress={() => setEditingFolder({ ...editingFolder, color: col })}
                    style={[
                      styles.colorPicker,
                      { backgroundColor: col },
                      editingFolder.color === col && styles.colorPickerSelected,
                    ]}>
                    {editingFolder.color === col && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.overlayActions}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.shareFolderButton}
                  onPress={() => {
                    setSharingFolder(editingFolder);
                    setShowShareFolderModal(true);
                    setShowEditFolderOverlay(false);
                    fetchFolderCollaborators(editingFolder.id);
                  }}>
                  <Ionicons name="people-outline" size={18} color="#3b82f6" />
                  <Text style={styles.shareFolderButtonText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteFolderButton}
                  onPress={() => {
                    setFolderToDelete(editingFolder);
                    setDeleteFolderConfirmOpen(true);
                    setShowEditFolderOverlay(false);
                  }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={styles.deleteFolderButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                <TouchableOpacity
                  style={styles.overlayCancelButton}
                  onPress={() => {
                    setShowEditFolderOverlay(false);
                    setEditingFolder(null);
                  }}>
                  <Text style={styles.overlayCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.overlayCreateButton,
                    !editingFolder.name.trim() && styles.overlayCreateButtonDisabled,
                  ]}
                  disabled={!editingFolder.name.trim()}
                  onPress={async () => {
                    await updateFolder(
                      editingFolder.id,
                      editingFolder.name,
                      editingFolder.icon || null,
                      editingFolder.color || null
                    );
                    setShowEditFolderOverlay(false);
                    setEditingFolder(null);
                  }}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={!editingFolder.name.trim() ? '#9ca3af' : '#fff'}
                  />
                  <Text
                    style={[
                      styles.overlayCreateText,
                      !editingFolder.name.trim() && styles.overlayCreateTextDisabled,
                    ]}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Delete Folder Confirmation */}
      {deleteFolderConfirmOpen && folderToDelete && (
        <Animated.View
          entering={isWeb ? undefined : FadeIn.duration(200)}
          exiting={isWeb ? undefined : FadeOut.duration(150)}
          style={[
            styles.overlay,
            isWeb && {
              position: 'fixed' as any,
            },
          ]}>
          <Pressable
            style={styles.overlayBackdrop}
            onPress={() => {
              setDeleteFolderConfirmOpen(false);
              setFolderToDelete(null);
            }}
          />
          <Animated.View
            entering={isWeb ? undefined : ZoomIn.duration(250).springify()}
            exiting={isWeb ? undefined : ZoomOut.duration(180)}
            style={styles.deleteConfirmCard}>
            {/* Icon */}
            <View style={styles.deleteConfirmIconBox}>
              <Ionicons name="folder" size={32} color="#ef4444" />
            </View>

            {/* Title & Message */}
            <Text style={styles.deleteConfirmTitle}>Delete Folder?</Text>
            <Text style={styles.deleteConfirmMessage}>
              Are you sure you want to delete "{folderToDelete.name}"? Notes in this folder will be moved to "No Folder".
            </Text>

            {/* Actions */}
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.deleteConfirmCancelButton}
                onPress={() => {
                  setDeleteFolderConfirmOpen(false);
                  setFolderToDelete(null);
                }}>
                <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmDeleteButton}
                onPress={async () => {
                  await deleteFolder(folderToDelete.id);
                  setDeleteFolderConfirmOpen(false);
                  setFolderToDelete(null);
                  setEditingFolder(null);
                }}>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Share Folder Modal */}
      {showShareFolderModal && sharingFolder && (
        <ShareModal
          visible={showShareFolderModal}
          onClose={() => {
            setShowShareFolderModal(false);
            setSharingFolder(null);
            setUserSearchQuery('');
            setSearchedUsers([]);
          }}
          title={`Share "${sharingFolder.name}"`}
          collaborators={folderCollaborators}
          searchQuery={userSearchQuery}
          onSearchChange={(query) => {
            setUserSearchQuery(query);
            searchUsers(query);
          }}
          searchResults={searchedUsers}
          loading={shareLoading}
          onAddCollaborator={(userId, permission) => {
            shareFolderWithUser(sharingFolder.id, userId, permission);
          }}
          onRemoveCollaborator={(collaboratorId) => {
            removeFolderCollaborator(collaboratorId, sharingFolder.id);
          }}
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
          <Text style={styles.subheading}>{tasks.length} total</Text>
        </View>
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
          <Text style={styles.subheading}>{events.length} upcoming</Text>
        </View>
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
            {reminders.filter((r) => !r.is_done).length} active
          </Text>
        </View>
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
  sharedFolders: NoteFolder[];
  loading: boolean;
  notesLoading: boolean;
  error: string | null;
  value: string;
  onChangeValue: (v: string) => void;
  onAdd: (nameOverride?: string, iconOverride?: string | null, colorOverride?: string | null) => void;
  onRefresh: () => void;
  notes: Note[];
  sharedNotes: Note[];
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
  onDeleteNote: (id: string) => Promise<void>;
  onShareNote: (note: Note) => void;
  autoSaveStatus: 'saved' | 'saving' | 'idle';
  notesSearchQuery: string;
  onNotesSearchChange: (query: string) => void;
  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (open: boolean) => void;
  noteToDelete: string | null;
  setNoteToDelete: (id: string | null) => void;
  showFolderOverlay: boolean;
  setShowFolderOverlay: (show: boolean) => void;
  folderOverlayName: string;
  setFolderOverlayName: (name: string) => void;
  folderOverlayColor: string | null;
  setFolderOverlayColor: (color: string | null) => void;
  folderOverlayIcon: string | null;
  setFolderOverlayIcon: (icon: string | null) => void;
  editingFolder: NoteFolder | null;
  setEditingFolder: (folder: NoteFolder | null) => void;
  showEditFolderOverlay: boolean;
  setShowEditFolderOverlay: (show: boolean) => void;
  currentUserId: string | undefined;
};

function NotesView({
  folders,
  sharedFolders,
  loading,
  notesLoading,
  error,
  value,
  onChangeValue,
  onAdd,
  onRefresh,
  notes,
  sharedNotes,
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
  onDeleteNote,
  onShareNote,
  autoSaveStatus,
  notesSearchQuery,
  onNotesSearchChange,
  deleteConfirmOpen,
  setDeleteConfirmOpen,
  noteToDelete,
  setNoteToDelete,
  showFolderOverlay,
  setShowFolderOverlay,
  folderOverlayName,
  setFolderOverlayName,
  folderOverlayColor,
  setFolderOverlayColor,
  folderOverlayIcon,
  setFolderOverlayIcon,
  editingFolder,
  setEditingFolder,
  showEditFolderOverlay,
  setShowEditFolderOverlay,
  currentUserId,
}: NotesViewProps) {
  // Calculate totals based on actual notes, not folder counts (which may be stale)
  const totalNotes = notes.length + sharedNotes.length;
  const looseNotes = notes.filter((n) => !n.folder_id);
  const looseSharedNotes = sharedNotes.filter((n) => !n.folder_id);

  console.log('🔍 NotesView render:', {
    notesCount: notes.length,
    sharedNotesCount: sharedNotes.length,
    totalNotes,
    sharedNotes: sharedNotes
  });

  // Helper function to convert HTML to plain text for searching
  const toPlainTextSearch = (html?: string | null): string => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Filter notes based on folder selection AND search query
  // If searching, search across ALL notes (including all folders and shared notes)
  // If not searching, show notes based on folder selection
  const filteredNotes = notesSearchQuery.trim()
    ? [...notes, ...sharedNotes].filter((note) => {
        const searchLower = notesSearchQuery.toLowerCase();
        const titleMatch = note.title.toLowerCase().includes(searchLower);
        const contentMatch = toPlainTextSearch(note.content).toLowerCase().includes(searchLower);
        return titleMatch || contentMatch;
      })
    : selectedFolderId === 'shared'
      ? looseSharedNotes
      : selectedFolderId
        ? [...notes, ...sharedNotes].filter((n) => n.folder_id === selectedFolderId)
        : looseNotes;
  const { width: windowWidth } = useWindowDimensions();
  const isSmallDevice = windowWidth < 400;
  const [showSearchBar, setShowSearchBar] = useState(false);
  const colors = [
    '#4f46e5', // Indigo
    '#7c3aed', // Purple
    '#2563eb', // Blue
    '#0891b2', // Cyan
    '#059669', // Green
    '#65a30d', // Lime
    '#ca8a04', // Yellow
    '#ea580c', // Orange
    '#dc2626', // Red
    '#e11d48', // Rose
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#06b6d4', // Bright Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#6366f1', // Light Indigo
  ];
  const icons: (keyof typeof Ionicons.glyphMap)[] = [
    // Werk & Productiviteit
    'briefcase-outline',
    'business-outline',
    'calendar-outline',
    'clipboard-outline',
    'document-text-outline',
    'folder-outline',
    'laptop-outline',
    'code-slash-outline',
    'stats-chart-outline',
    'trending-up-outline',

    // School & Studie
    'school-outline',
    'book-outline',
    'library-outline',
    'pencil-outline',
    'calculator-outline',
    'flask-outline',
    'bulb-outline',
    'newspaper-outline',

    // Privé & Lifestyle
    'home-outline',
    'heart-outline',
    'chatbubbles-outline',
    'people-outline',
    'cafe-outline',
    'restaurant-outline',
    'fitness-outline',
    'bicycle-outline',
    'airplane-outline',
    'car-outline',
    'basketball-outline',
    'game-controller-outline',

    // Creatief & Hobby
    'brush-outline',
    'color-palette-outline',
    'musical-notes-outline',
    'camera-outline',
    'images-outline',
    'videocam-outline',
    'mic-outline',
    'headset-outline',

    // Organisatie & Planning
    'star-outline',
    'flag-outline',
    'bookmark-outline',
    'list-outline',
    'checkbox-outline',
    'lock-closed-outline',
    'key-outline',
    'settings-outline',

    // Natuur & Diversen
    'leaf-outline',
    'planet-outline',
    'sunny-outline',
    'moon-outline',
    'cloud-outline',
    'thunderstorm-outline',
    'paw-outline',
    'flame-outline',
  ];
  const [richLib, setRichLib] = useState<{ RichEditor: any; RichToolbar: any; actions: any } | null>(null);
  const richRef = useRef<any | null>(null);
  const webEditorRef = useRef<HTMLDivElement | null>(null);
  const savedWebRange = useRef<Range | null>(null);
  const [inlineStates, setInlineStates] = useState({
    bold: false,
    italic: false,
    underline: false,
  });
  const [webStates, setWebStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    h1: false,
    h2: false,
    highlight: false,
  });

  // Simple highlight state
  const [highlightColor, setHighlightColor] = useState('#fff59d'); // default yellow
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 20, y: 140 });
  const [isDraggingPicker, setIsDraggingPicker] = useState(false);
  const pickerDragStart = useRef({ x: 0, y: 0 });

  // Handle dragging on window level for smooth movement
  useEffect(() => {
    if (!isWeb || !isDraggingPicker) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new position
      let newX = e.clientX - pickerDragStart.current.x;
      let newY = e.clientY - pickerDragStart.current.y;

      // Constrain to viewport bounds
      // Color picker is ~220px wide
      const minX = 0; // Flush with left edge
      const maxX = window.innerWidth - 220; // Don't go off right edge
      const minY = 0; // Flush with top edge

      newX = Math.max(minX, Math.min(newX, maxX));
      newY = Math.max(minY, newY); // Only constrain top, allow going down

      setPickerPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingPicker(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPicker, isWeb]);

  const computeWebStates = () => {
    const bold = document.queryCommandState('bold') || false;
    const italic = document.queryCommandState('italic') || false;
    const underline = document.queryCommandState('underline') || false;
    const list = document.queryCommandState('insertUnorderedList') || false;
    const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    return {
      bold,
      italic,
      underline,
      list,
      h1: block === 'h1',
      h2: block === 'h2',
      // highlight is managed separately, don't include it here
    };
  };
  const captureSelection = () => {
    if (isWeb) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (webEditorRef.current?.contains(range.commonAncestorContainer)) {
          savedWebRange.current = range.cloneRange();
        }
      }
    }
  };
  const restoreSelection = () => {
    if (!isWeb) return;
    const sel = window.getSelection();
    if (sel && savedWebRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedWebRange.current);
    }
  };

  const isClient = typeof window !== 'undefined';

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

  const lastManualToggleRef = useRef<number>(0);

  useEffect(() => {
    if (!isWeb) return;
    let timeoutId: NodeJS.Timeout;
    const handleSelectionWithRange = () => {
      // Debounce and skip if we recently manually toggled
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Skip if manual toggle happened within last 2 seconds
        if (Date.now() - lastManualToggleRef.current < 2000) return;

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const editorEl = webEditorRef.current;
          if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
            savedWebRange.current = range.cloneRange();
            // Update all states from the document when selection changes
            const computed = computeWebStates();
            setWebStates((prev) => ({ ...prev, ...computed }));
          }
        }
      }, 10);
    };
    document.addEventListener('selectionchange', handleSelectionWithRange);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('selectionchange', handleSelectionWithRange);
    };
  }, []);

  // Enforce formatting state before and during input - if a format is OFF, actively remove it
  useEffect(() => {
    if (!isWeb || !noteModalOpen) return;
    const editor = webEditorRef.current;
    if (!editor) return;

    const enforceFormatting = () => {
      const skipBoldItalicUnderline = Date.now() - lastManualToggleRef.current < 2000;

      // Check if any formatting that should be OFF is currently active in the DOM
      if (!skipBoldItalicUnderline) {
        const domBold = document.queryCommandState('bold') || false;
        const domItalic = document.queryCommandState('italic') || false;
        const domUnderline = document.queryCommandState('underline') || false;

        // If our state says OFF but DOM says ON, force it OFF
        if (!webStates.bold && domBold) {
          document.execCommand('bold', false, undefined);
        }
        if (!webStates.italic && domItalic) {
          document.execCommand('italic', false, undefined);
        }
        if (!webStates.underline && domUnderline) {
          document.execCommand('underline', false, undefined);
        }
      }

      // ALWAYS enforce highlight state (don't skip)
      const currentBgColor = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor') || '';
      const hasBackground = currentBgColor &&
                           currentBgColor !== 'transparent' &&
                           currentBgColor !== 'rgba(0, 0, 0, 0)' &&
                           currentBgColor !== 'rgb(255, 255, 255)';

      if (webStates.highlight && !hasBackground) {
        // State says ON but no background - apply it
        document.execCommand('hiliteColor', false, highlightColor);
      } else if (!webStates.highlight && hasBackground) {
        // State says OFF but has background - REMOVE it by toggling
        // Insert a zero-width space without background to break the formatting
        document.execCommand('insertHTML', false, '<span style="background-color: transparent;">&#8203;</span>');
      } else if (webStates.highlight && hasBackground && currentBgColor !== highlightColor) {
        // Has background but wrong color - apply correct color
        document.execCommand('hiliteColor', false, highlightColor);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Before any character is typed, ensure formatting is correct
      if (e.key.length === 1 || e.key === 'Enter') {
        enforceFormatting();
      }
    };

    const handleInput = () => {
      // After input, clean up any formatting that snuck through
      enforceFormatting();
    };

    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('input', handleInput);
    return () => {
      editor.removeEventListener('keydown', handleKeyDown);
      editor.removeEventListener('input', handleInput);
    };
  }, [isWeb, noteModalOpen, webStates.bold, webStates.italic, webStates.underline, webStates.highlight, highlightColor]);

  // Hydrate content only when de modal opent of een andere note wordt geladen.
  // deliberate lint disable: we willen noteBody NIET in deps om caret te behouden
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (noteModalOpen) {
      if (!isWeb && richRef.current) {
        richRef.current.setContentHTML(noteBody || '');
      }
      if (isWeb && webEditorRef.current) {
        webEditorRef.current.innerHTML = noteBody || '';
      }
    }
  }, [noteModalOpen, editingNote?.id, isWeb]);

  // Simple highlight toggle function
  const toggleHighlight = () => {
    if (!isWeb) return;
    const editor = webEditorRef.current;
    if (!editor) return;

    // Record timestamp to prevent state sync from interfering
    lastManualToggleRef.current = Date.now();

    const newState = !webStates.highlight;

    // Update visual state
    setWebStates((prev) => ({ ...prev, highlight: newState }));

    // If turning ON, apply highlight to any selected text immediately
    if (newState) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        restoreSelection();
        editor.focus();
        document.execCommand('hiliteColor', false, highlightColor);
        const html = editor.innerHTML ?? '';
        onChangeNoteBody(html);
        captureSelection();
      }
    }
  };

  const runWebCommand = (cmd: string, value?: string) => {
    if (!isWeb) return;
    try {
      const editor = webEditorRef.current;
      if (!editor) return;
      restoreSelection();
      editor.focus();
      document.execCommand(cmd, false, value);
      const html = editor.innerHTML ?? '';
      onChangeNoteBody(html);
      // Update states immediately after command
      const next = computeWebStates();
      setWebStates((prev) => ({ ...prev, ...next }));
      captureSelection();
    } catch (e) {
      console.warn('web command failed', cmd, e);
    }
  };

  const toggleInlineCommand = (cmd: 'bold' | 'italic' | 'underline') => {
    if (!isWeb) return;
    try {
      const editor = webEditorRef.current;
      if (!editor) return;

      // Record timestamp of manual toggle to prevent selectionchange handler from interfering
      lastManualToggleRef.current = Date.now();

      editor.focus();

      // Restore selection if we have it
      if (savedWebRange.current) {
        restoreSelection();
      }

      // Use the current React state to determine the toggle
      const wasActive = webStates[cmd];

      // If turning OFF and editor is empty or nearly empty, clear the innerHTML completely
      // to remove any lingering formatting tags
      if (wasActive && editor.textContent && editor.textContent.trim().length === 0) {
        editor.innerHTML = '<br>';
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } else {
        // execCommand toggles the format
        document.execCommand(cmd, false, undefined);
      }

      const html = editor.innerHTML ?? '';
      onChangeNoteBody(html);

      // Immediately set to the opposite state for instant visual feedback
      const newState = !wasActive;
      setWebStates((prev) => ({ ...prev, [cmd]: newState }));

      // Store current selection for later use
      const selAfter = window.getSelection();
      if (selAfter && selAfter.rangeCount > 0) {
        const range = selAfter.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          savedWebRange.current = range.cloneRange();
        }
      }
    } catch (e) {
      console.warn('inline command failed', cmd, e);
    }
  };

  // Dedicated editor screen (no overlay)
  if (noteModalOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f4f6', padding: 16, position: 'relative' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={styles.heroTitle}>{editingNote ? 'Edit Note' : 'New Note'}</Text>
            {/* Auto-save indicator */}
            {editingNote && autoSaveStatus !== 'idle' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {autoSaveStatus === 'saving' && (
                  <>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
                    <Text style={{ fontSize: 12, color: '#f59e0b', fontWeight: '500' }}>Saving...</Text>
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '500' }}>Saved</Text>
                  </>
                )}
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* Share and Export buttons - only show when editing existing note */}
            {editingNote && (
              <>
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}
                  onPress={() => {
                    if (editingNote) {
                      onShareNote(editingNote);
                    }
                  }}>
                  <Ionicons name="share-social-outline" size={20} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: '#fef3c7', borderColor: '#fde047' }]}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      // Create print container with content
                      const printContainer = document.createElement('div');
                      printContainer.id = 'print-note-container';
                      printContainer.className = 'print-note-container';
                      printContainer.innerHTML = `
                        <h1 class="print-note-title">
                          ${noteTitle || 'Untitled Note'}
                        </h1>
                        <div class="print-note-content">
                          ${noteBody || '<p style="color: #94a3b8; font-style: italic;">No content</p>'}
                        </div>
                      `;

                      // Add to body
                      document.body.appendChild(printContainer);

                      // Print
                      window.print();

                      // Remove after print
                      setTimeout(() => {
                        document.body.removeChild(printContainer);
                      }, 1000);
                    }
                  }}>
                  <Ionicons name="document-text-outline" size={20} color="#a16207" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.ghostButton, { paddingHorizontal: 14, height: 44 }]} onPress={onCloseNoteModal}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!noteTitle.trim() || notesLoading}
              style={[styles.primaryButton, { paddingHorizontal: 20, height: 44 }]}
              onPress={onCreateNote}>
              <Text style={styles.primaryButtonText}>{editingNote ? 'Back' : 'Create'}</Text>
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
              <View style={{ position: 'relative', overflow: 'visible', zIndex: 9998 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ overflow: 'visible' }}
                  contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                  <Pressable
                    style={[styles.toolbarButton, webStates.bold && { backgroundColor: '#e5e7ff', borderColor: ACCENT }]}
                    onPressIn={(e) => {
                      e.preventDefault?.();
                      toggleInlineCommand('bold');
                    }}>
                    <Text style={styles.toolbarButtonText}>B</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toolbarButton, webStates.italic && { backgroundColor: '#e5e7ff', borderColor: ACCENT }]}
                    onPressIn={(e) => {
                      e.preventDefault?.();
                      toggleInlineCommand('italic');
                    }}>
                    <Text style={[styles.toolbarButtonText, { fontStyle: 'italic' }]}>i</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toolbarButton, webStates.underline && { backgroundColor: '#e5e7ff', borderColor: ACCENT }]}
                    onPressIn={(e) => {
                      e.preventDefault?.();
                      toggleInlineCommand('underline');
                    }}>
                    <Text style={[styles.toolbarButtonText, { textDecorationLine: 'underline' }]}>U</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toolbarButton, webStates.list && { backgroundColor: '#e5e7ff', borderColor: ACCENT }]}
                    onPressIn={(e) => {
                      e.preventDefault?.();
                      runWebCommand('insertUnorderedList');
                    }}>
                    <Text style={styles.toolbarButtonText}>• List</Text>
                  </Pressable>

                  {/* Highlight button with color picker */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      style={[
                        styles.toolbarButton,
                        webStates.highlight && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }
                      ]}
                      onPressIn={(e) => {
                        e.preventDefault?.();
                        toggleHighlight();
                      }}>
                      <Text style={styles.toolbarButtonText}>Highlight</Text>
                    </Pressable>
                    <Pressable
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: highlightColor,
                        borderWidth: 2,
                        borderColor: '#d1d5db',
                      }}
                      onPress={() => setShowColorPicker(!showColorPicker)}
                    />
                  </View>

                  <Pressable
                    style={[styles.toolbarButton, webStates.h1 && { backgroundColor: '#e5e7ff', borderColor: ACCENT }]}
                    onPressIn={(e) => {
                      e.preventDefault?.();
                      const nextBlock = webStates.h1 ? 'p' : 'h1';
                      runWebCommand('formatBlock', nextBlock);
                    }}>
                    <Text style={styles.toolbarButtonText}>H1</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.toolbarButton, webStates.h2 && { backgroundColor: '#e5e7ff', borderColor: ACCENT }]}
                    onPressIn={(e) => {
                      e.preventDefault?.();
                      const nextBlock = webStates.h2 ? 'p' : 'h2';
                      runWebCommand('formatBlock', nextBlock);
                    }}>
                    <Text style={styles.toolbarButtonText}>H2</Text>
                  </Pressable>
                </ScrollView>
              </View>
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

          <View style={{ gap: 0, backgroundColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, borderRadius: 0 }}>
            {isWeb ? (
              <div
                ref={webEditorRef}
                contentEditable
                suppressContentEditableWarning
                onKeyUp={() => {
                  try {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                      const range = sel.getRangeAt(0);
                      if (webEditorRef.current?.contains(range.commonAncestorContainer)) {
                        savedWebRange.current = range.cloneRange();
                      }
                    }
                  } catch {
                    //
                  }
                }}
                onMouseUp={() => {
                  try {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                      const range = sel.getRangeAt(0);
                      if (webEditorRef.current?.contains(range.commonAncestorContainer)) {
                        savedWebRange.current = range.cloneRange();
                      }
                    }
                  } catch {
                    //
                  }
                }}
                  onInput={(e) => {
                    const html = (e.currentTarget as HTMLDivElement).innerHTML;
                    onChangeNoteBody(html);
                  }}
                  style={{
                    minHeight: 760,
                    padding: '28px',
                    width: '100%',
                    maxWidth: 720,
                    margin: '0 auto',
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    outline: 'none',
                    fontSize: 16,
                    lineHeight: 1.7,
                    fontFamily: 'Arial, sans-serif',
                    color: '#0f172a',
                    cursor: 'text',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    textAlign: 'left',
                  display: 'block',
                  boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                }}
              />
            ) : (
              <View style={[styles.docPage, { minHeight: 420, padding: 0 }]}>
                {richLib?.RichEditor ? (
                  <richLib.RichEditor
                    ref={richRef as any}
                    initialContentHTML={noteBody}
                    placeholder="Start writing zoals Google Docs..."
                    onChange={(html: string) => onChangeNoteBody(html || '')}
                    editorStyle={{
                      backgroundColor: '#fff',
                      fontFamily: 'Arial',
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
            )}
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

        {/* Color picker dropdown - draggable */}
        {showColorPicker && isWeb && (
          <div
            style={{
              position: 'absolute',
              top: pickerPosition.y,
              left: pickerPosition.x,
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'row',
              gap: 8,
              flexWrap: 'wrap',
              maxWidth: 200,
              cursor: isDraggingPicker ? 'grabbing' : 'grab',
            }}
            onMouseDown={(e) => {
              // Only drag if clicking on the padding area (not on color buttons)
              if ((e.target as HTMLElement).tagName === 'DIV') {
                e.preventDefault();
                setIsDraggingPicker(true);
                pickerDragStart.current = {
                  x: e.clientX - pickerPosition.x,
                  y: e.clientY - pickerPosition.y,
                };
              }
            }}>
            {[
              '#fff59d', // geel (default)
              '#bfdbfe', // pastel blauw
              '#fecaca', // pastel rood
              '#e9d5ff', // pastel paars
              '#fbcfe8', // pastel roze
              '#fed7aa', // pastel oranje
              '#d9f99d', // pastel lime
              '#bbf7d0', // pastel groen
              '#99f6e4', // pastel teal
              '#a5f3fc', // pastel cyan
            ].map((color) => (
              <button
                key={color}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: color,
                  border: `2px solid ${highlightColor === color ? '#111827' : '#d1d5db'}`,
                  cursor: 'pointer',
                  padding: 0,
                }}
                onClick={() => {
                  setHighlightColor(color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={styles.notesContainer}>
      {/* Ultra-Premium Header with Glassmorphism */}
      <Animated.View
        entering={isWeb ? undefined : FadeInDown.duration(400).springify()}
        style={styles.ultraHeader}>
        {/* Top Bar with Breadcrumb */}
        <View style={styles.ultraTopBar}>
          <View style={styles.breadcrumbContainer}>
            <View style={styles.breadcrumbIconBox}>
              <Ionicons name="home" size={12} color={ACCENT} />
            </View>
            <Ionicons name="chevron-forward" size={11} color="#cbd5e1" />
            <Text style={styles.breadcrumbActive}>Notes</Text>
            <View style={styles.liveDot}>
              <View style={styles.liveDotInner} />
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statBubble}>
              <Ionicons name="document-text" size={14} color={ACCENT} />
              <Text style={styles.statBubbleText}>{totalNotes}</Text>
            </View>
            <View style={styles.statBubble}>
              <Ionicons name="folder" size={14} color="#f59e0b" />
              <Text style={styles.statBubbleText}>{folders.length}</Text>
            </View>
          </View>
        </View>

        {/* Hero Title Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconGlow} />
              <View style={styles.heroIconInner}>
                <Ionicons name="albums" size={32} color={ACCENT} />
              </View>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>My Notes</Text>
              <Text style={styles.heroSubtitle}>
                {totalNotes === 0 ? 'Start capturing your ideas' : `${totalNotes} ${totalNotes === 1 ? 'note' : 'notes'} saved`}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.searchButton, showSearchBar && { backgroundColor: ACCENT + '15', borderColor: ACCENT }]}
              onPress={() => {
                setShowSearchBar(!showSearchBar);
                if (showSearchBar) {
                  onNotesSearchChange('');
                }
              }}>
              <Ionicons name="search" size={20} color={showSearchBar ? ACCENT : "#64748b"} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.folderButton}
              onPress={() => {
                setFolderOverlayName(value.trim() || '');
                setFolderOverlayColor(colors[0]);
                setFolderOverlayIcon(icons[0]);
                setShowFolderOverlay(true);
              }}>
              <Ionicons name="folder-open-outline" size={18} color="#64748b" />
              <Text style={styles.folderButtonText}>Folder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createButton}
              onPress={onOpenNoteModal}>
              <View style={styles.createButtonGlow} />
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createButtonText}>New Note</Text>
              <View style={styles.createButtonShine} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Ultra-Modern Search Bar */}
        {showSearchBar && (
          <Animated.View
            entering={isWeb ? undefined : FadeInDown.duration(300).springify()}
            exiting={isWeb ? undefined : FadeOut.duration(200)}
            style={styles.ultraSearchContainer}>
            <View style={styles.ultraSearchCard}>
              {/* Search Icon with Glow */}
              <View style={styles.ultraSearchIconBox}>
                <View style={styles.ultraSearchIconGlow} />
                <Ionicons name="search" size={20} color={ACCENT} />
              </View>

              {/* Search Input */}
              <TextInput
                style={[
                  styles.ultraSearchInput,
                  isWeb && { outline: 'none' } as any,
                ]}
                placeholder="Search across all notes and folders..."
                placeholderTextColor="#94a3b8"
                value={notesSearchQuery}
                onChangeText={onNotesSearchChange}
                autoFocus
                returnKeyType="search"
              />

              {/* Clear Button or Results Count */}
              {notesSearchQuery.length > 0 && (
                <View style={styles.ultraSearchActions}>
                  <View style={styles.ultraSearchResultsBadge}>
                    <Text style={styles.ultraSearchResultsText}>
                      {filteredNotes.length}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.ultraSearchClearButton}
                    onPress={() => onNotesSearchChange('')}>
                    <Ionicons name="close-circle" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Premium Filter Pills */}
      <Animated.View
        entering={isWeb ? undefined : FadeInDown.duration(300).delay(50)}
        style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => onSelectFolder(null)}
              style={[
                styles.filterChip,
                !selectedFolderId && styles.filterChipActive,
              ]}>
              <View style={[styles.filterChipIconBg, !selectedFolderId && styles.filterChipIconBgActive]}>
                <Ionicons name="grid" size={14} color={!selectedFolderId ? '#fff' : '#64748b'} />
              </View>
              <Text style={[styles.filterChipText, !selectedFolderId && styles.filterChipTextActive]}>
                All
              </Text>
              <View style={[styles.filterChipBadge, !selectedFolderId && styles.filterChipBadgeActive]}>
                <Text style={[styles.filterChipBadgeText, !selectedFolderId && styles.filterChipBadgeTextActive]}>
                  {looseNotes.length}
                </Text>
              </View>
            </Pressable>
            {folders.map((folder) => {
              const isActive = selectedFolderId === folder.id;
              return (
                <Pressable
                  key={folder.id}
                  onPress={() => onSelectFolder(folder.id)}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}>
                  <View style={[styles.filterChipIconBg, isActive && styles.filterChipIconBgActive]}>
                    <Ionicons name={(folder.icon as any) || 'folder'} size={14} color={isActive ? '#fff' : '#64748b'} />
                  </View>
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {folder.name}
                  </Text>
                  <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                    <Text style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}>
                      {notes.filter((n) => n.folder_id === folder.id).length}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.contentSection}>
          {/* Ultra-Modern Folders Grid */}
          {(folders.length > 0 || sharedFolders.length > 0 || looseSharedNotes.length > 0) && (
            <Animated.View
              entering={isWeb ? undefined : FadeInDown.duration(350).delay(100)}
              style={styles.modernFoldersSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="folder" size={18} color="#f59e0b" />
                  </View>
                  <Text style={styles.modernSectionTitle}>Folders</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{folders.length + sharedFolders.length + (looseSharedNotes.length > 0 ? 1 : 0)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.ultraFoldersGrid}>
                {folders.map((folder, index) => {
                  const folderNoteCount = [...notes, ...sharedNotes].filter((n) => n.folder_id === folder.id).length;
                  return (
                    <Animated.View
                      entering={isWeb ? undefined : FadeInDown.duration(280).delay(150 + index * 50)}
                      layout={isWeb ? undefined : Layout.springify()}
                      key={folder.id}>
                      <Pressable
                        onPress={() => onSelectFolder(folder.id)}
                        style={({ pressed }) => [
                          styles.ultraFolderCard,
                          selectedFolderId === folder.id && [
                            styles.ultraFolderCardActive,
                            {
                              backgroundColor: (folder.color || ACCENT) + '08',
                              borderColor: folder.color || ACCENT,
                            }
                          ],
                          pressed && styles.ultraFolderCardPressed,
                        ]}>
                        {/* Top Color Bar - shown when active */}
                        {selectedFolderId === folder.id && (
                          <View style={[styles.ultraFolderGradient, { backgroundColor: folder.color || ACCENT }]} />
                        )}

                        {/* Content */}
                        <View style={styles.ultraFolderContent}>
                          <View style={styles.ultraFolderTop}>
                            <View style={[styles.ultraFolderIcon, { backgroundColor: (folder.color || ACCENT) + '20' }]}>
                              <Ionicons name={(folder.icon as any) || 'folder'} size={28} color={folder.color || ACCENT} />
                            </View>
                            <View style={styles.ultraFolderTopRight}>
                              <View style={styles.ultraFolderBadge}>
                                <Ionicons name="document-text" size={12} color="#64748b" />
                                <Text style={styles.ultraFolderBadgeText}>{folderNoteCount}</Text>
                              </View>
                              {selectedFolderId === folder.id && (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setEditingFolder(folder);
                                    setShowEditFolderOverlay(true);
                                  }}
                                  style={({ pressed }) => [
                                    styles.folderEditButton,
                                    pressed && styles.folderEditButtonPressed,
                                  ]}>
                                  <Ionicons name="ellipsis-horizontal" size={18} color="#94a3b8" />
                                </Pressable>
                              )}
                            </View>
                          </View>

                          <View style={styles.ultraFolderInfo}>
                            <Text style={styles.ultraFolderName} numberOfLines={1}>
                              {folder.name}
                            </Text>
                            <Text style={styles.ultraFolderDate}>
                              {folder.created_at
                                ? new Date(folder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : 'Today'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}

                {/* Shared Folders */}
                {sharedFolders.map((folder, index) => {
                  const folderNoteCount = [...notes, ...sharedNotes].filter((n) => n.folder_id === folder.id).length;
                  return (
                    <Animated.View
                      entering={isWeb ? undefined : FadeInDown.duration(280).delay(150 + (folders.length + index) * 50)}
                      layout={isWeb ? undefined : Layout.springify()}
                      key={folder.id}>
                      <Pressable
                        onPress={() => onSelectFolder(folder.id)}
                        style={({ pressed }) => [
                          styles.ultraFolderCard,
                          selectedFolderId === folder.id && [
                            styles.ultraFolderCardActive,
                            {
                              backgroundColor: (folder.color || ACCENT) + '08',
                              borderColor: folder.color || ACCENT,
                            }
                          ],
                          pressed && styles.ultraFolderCardPressed,
                        ]}>
                        {/* Top Color Bar - shown when active */}
                        {selectedFolderId === folder.id && (
                          <View style={[styles.ultraFolderGradient, { backgroundColor: folder.color || ACCENT }]} />
                        )}

                        {/* Content */}
                        <View style={styles.ultraFolderContent}>
                          <View style={styles.ultraFolderTop}>
                            <View style={[styles.ultraFolderIcon, { backgroundColor: (folder.color || ACCENT) + '20' }]}>
                              <Ionicons name={(folder.icon as any) || 'folder'} size={28} color={folder.color || ACCENT} />
                            </View>
                            <View style={styles.ultraFolderTopRight}>
                              <View style={styles.ultraFolderBadge}>
                                <Ionicons name="document-text" size={12} color="#64748b" />
                                <Text style={styles.ultraFolderBadgeText}>{folderNoteCount}</Text>
                              </View>
                              <View style={styles.sharedFolderIndicator}>
                                <Ionicons name="people" size={14} color="#10b981" />
                              </View>
                            </View>
                          </View>

                          <View style={styles.ultraFolderInfo}>
                            <Text style={styles.ultraFolderName} numberOfLines={1}>
                              {folder.name}
                            </Text>
                            <Text style={styles.ultraFolderDate}>
                              Shared folder
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}

                {/* Shared Notes Virtual Folder */}
                {looseSharedNotes.length > 0 && (
                  <Animated.View
                    entering={isWeb ? undefined : FadeInDown.duration(280).delay(150 + folders.length * 50)}
                    layout={isWeb ? undefined : Layout.springify()}>
                    <Pressable
                      onPress={() => onSelectFolder('shared')}
                      style={({ pressed }) => [
                        styles.ultraFolderCard,
                        selectedFolderId === 'shared' && [
                          styles.ultraFolderCardActive,
                          {
                            backgroundColor: '#10b98108',
                            borderColor: '#10b981',
                          }
                        ],
                        pressed && styles.ultraFolderCardPressed,
                      ]}>
                      {/* Top Color Bar - shown when active */}
                      {selectedFolderId === 'shared' && (
                        <View style={[styles.ultraFolderGradient, { backgroundColor: '#10b981' }]} />
                      )}

                      {/* Content */}
                      <View style={styles.ultraFolderContent}>
                        <View style={styles.ultraFolderTop}>
                          <View style={[styles.ultraFolderIcon, { backgroundColor: '#10b98120' }]}>
                            <Ionicons name="people" size={28} color="#10b981" />
                          </View>
                          <View style={styles.ultraFolderBadge}>
                            <Ionicons name="document-text" size={12} color="#64748b" />
                            <Text style={styles.ultraFolderBadgeText}>{looseSharedNotes.length}</Text>
                          </View>
                        </View>

                        <View style={styles.ultraFolderInfo}>
                          <Text style={styles.ultraFolderName} numberOfLines={1}>
                            Shared with me
                          </Text>
                          <Text style={styles.ultraFolderDate}>
                            {looseSharedNotes.length} {looseSharedNotes.length === 1 ? 'note' : 'notes'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Ultra-Premium Notes List */}
          {notesLoading ? (
            <View style={styles.ultraLoadingContainer}>
              <View style={styles.ultraLoadingSpinner}>
                <ActivityIndicator color={ACCENT} size="large" />
              </View>
              <Text style={styles.ultraLoadingText}>Loading your notes...</Text>
            </View>
          ) : filteredNotes.length ? (
            <Animated.View
              entering={isWeb ? undefined : FadeInDown.duration(300).delay(folders.length > 0 ? 200 : 100)}
              style={styles.ultraNotesSection}>
              {/* Section Header */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIconBox, { backgroundColor: ACCENT + '15' }]}>
                    <Ionicons name="document-text" size={18} color={ACCENT} />
                  </View>
                  <Text style={styles.modernSectionTitle}>Recent Notes</Text>
                  <View style={[styles.sectionBadge, { backgroundColor: ACCENT + '12' }]}>
                    <Text style={[styles.sectionBadgeText, { color: ACCENT }]}>{filteredNotes.length}</Text>
                  </View>
                </View>
              </View>

              {/* Ultra-Modern Notes Grid */}
              <View style={styles.ultraNotesGrid}>
                {filteredNotes.map((note, index) => {
                  const wordCount = toPlainTextSearch(note.content).split(' ').filter(Boolean).length;
                  const charCount = toPlainTextSearch(note.content).length;
                  const hasContent = charCount > 0;
                  const isOwnNote = note.owner_id === currentUserId;
                  const isShared = sharedNotes.some((sn) => sn.id === note.id);

                  // Check if note is in a shared folder
                  // A note is in a shared folder if it has a folder_id and appears in sharedNotes
                  const isInSharedFolder = note.folder_id && isShared;

                  // Debug: log once for testing
                  if (index === 0 && isOwnNote) {
                    console.log('🔍 Note share button check:', {
                      title: note.title,
                      folder_id: note.folder_id,
                      isShared,
                      isInSharedFolder,
                      showShareButton: !isInSharedFolder
                    });
                  }

                  // Find which folder this note belongs to (only when searching)
                  const noteFolder = notesSearchQuery.trim() && note.folder_id
                    ? folders.find((f) => f.id === note.folder_id)
                    : null;

                  return (
                  <Animated.View
                    key={note.id}
                    entering={isWeb ? undefined : FadeInDown.duration(400).delay(200 + index * 50).springify()}
                    layout={isWeb ? undefined : Layout.springify()}
                    style={styles.ultraNoteCardWrapper}>
                    <Pressable
                      onPress={() => onOpenExistingNote(note)}
                      style={({ pressed }) => [
                        styles.ultraNoteCard,
                        {
                          borderColor: (note.color || ACCENT) + '30',
                          backgroundColor: (note.color || ACCENT) + '05',
                        },
                        pressed && styles.ultraNoteCardPressed
                      ]}>
                      {/* Card Content */}
                      <View style={styles.ultraNoteContentWrapper}>
                        {/* Header with Icon and Status */}
                        <View style={styles.ultraNoteHeader}>
                          <View style={styles.ultraNoteTitleSection}>
                            <View style={[styles.ultraNoteIconBox, { backgroundColor: (note.color || ACCENT) + '18' }]}>
                              <Ionicons name="document-text" size={22} color={note.color || ACCENT} />
                            </View>
                            <View style={styles.ultraNoteTitleWrapper}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.ultraNoteTitle} numberOfLines={1}>
                                  {note.title}
                                </Text>
                                {isShared && (
                                  <View style={styles.sharedBadge}>
                                    <Ionicons name="people" size={11} color="#10b981" />
                                    <Text style={styles.sharedBadgeText}>Shared</Text>
                                  </View>
                                )}
                                {noteFolder && (
                                  <View style={[styles.folderBadge, { backgroundColor: (noteFolder.color || '#64748b') + '15' }]}>
                                    <Ionicons name={(noteFolder.icon as any) || 'folder'} size={10} color={noteFolder.color || '#64748b'} />
                                    <Text style={[styles.folderBadgeText, { color: noteFolder.color || '#64748b' }]}>{noteFolder.name}</Text>
                                  </View>
                                )}
                                {notesSearchQuery.trim() && !note.folder_id && !isShared && (
                                  <View style={[styles.folderBadge, { backgroundColor: '#94a3b815' }]}>
                                    <Ionicons name="document-outline" size={10} color="#94a3b8" />
                                    <Text style={[styles.folderBadgeText, { color: '#94a3b8' }]}>No folder</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.ultraNoteStatusRow}>
                                <View style={[styles.ultraStatusDot, { backgroundColor: hasContent ? '#10b981' : '#94a3b8' }]} />
                                <Text style={styles.ultraNoteStatus}>
                                  {hasContent ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'}` : 'Empty note'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Content Preview with Fade Effect */}
                        {hasContent && (
                          <View style={styles.ultraNotePreviewContainer}>
                            <Text numberOfLines={3} style={styles.ultraNotePreview}>
                              {toPlainTextSearch(note.content)}
                            </Text>
                            <View style={styles.ultraNotePreviewFade} />
                          </View>
                        )}

                        {/* Footer with Meta Info and Actions */}
                        <View style={styles.ultraNoteFooter}>
                          <View style={styles.ultraNoteMetaSection}>
                            <View style={styles.ultraNoteDateBox}>
                              <Ionicons name="calendar-outline" size={14} color="#64748b" />
                              <Text style={styles.ultraNoteDateText}>
                                {note.created_at
                                  ? new Date(note.created_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    })
                                  : 'Today'}
                              </Text>
                            </View>
                            {charCount > 0 && (
                              <View style={styles.ultraNoteCharBox}>
                                <Ionicons name="text-outline" size={14} color="#64748b" />
                                <Text style={styles.ultraNoteCharText}>{charCount}</Text>
                              </View>
                            )}
                          </View>

                          {/* Premium Action Buttons */}
                          <View style={styles.ultraNoteActionsRow}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.ultraActionButton,
                                pressed && styles.ultraActionButtonPressed
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                onOpenExistingNote(note);
                              }}>
                              <Ionicons name="create-outline" size={16} color={ACCENT} />
                            </Pressable>
                            {isOwnNote && (
                              <>
                                {!isInSharedFolder && (
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.ultraActionButton,
                                      pressed && styles.ultraActionButtonPressed
                                    ]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      onShareNote(note);
                                    }}>
                                    <Ionicons name="people-outline" size={16} color="#10b981" />
                                  </Pressable>
                                )}
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.ultraActionButton,
                                    pressed && styles.ultraActionButtonPressed
                                  ]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setNoteToDelete(note.id);
                                    setDeleteConfirmOpen(true);
                                  }}>
                                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </Pressable>
                              </>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Hover Shine Effect */}
                      <View style={styles.ultraNoteShine} />
                    </Pressable>
                  </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              style={styles.premiumEmptyState}
              entering={isWeb ? undefined : FadeInDown.duration(300).delay(200)}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="document-outline" size={48} color={ACCENT} />
              </View>
              <Text style={styles.emptyStateTitle}>No notes yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Create your first note to capture your ideas
              </Text>
              <TouchableOpacity style={styles.emptyStateCTA} onPress={onOpenNoteModal}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyStateCTAText}>Create Note</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      )}
    </View>
    </>
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

type ShareModalProps = {
  visible: boolean;
  note?: Note | null;
  title?: string;
  collaborators: NoteCollaborator[];
  searchQuery: string;
  searchResults: UserProfile[];
  loading: boolean;
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onSearch?: (query: string) => Promise<void>;
  onAddCollaborator: (userId: string, permission: 'view' | 'edit') => void;
  onRemoveCollaborator: (collaboratorId: string) => void;
};

function ShareModal({
  visible,
  note,
  title,
  collaborators,
  searchQuery,
  searchResults,
  loading,
  onClose,
  onSearchChange,
  onSearch,
  onAddCollaborator,
  onRemoveCollaborator,
}: ShareModalProps) {
  if (!visible) return null;

  const displayTitle = title || (note ? `Share "${note.title}"` : 'Share');

  return (
    <Animated.View
      entering={isWeb ? undefined : FadeIn.duration(200)}
      exiting={isWeb ? undefined : FadeOut.duration(150)}
      style={styles.modalOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        entering={isWeb ? undefined : ZoomIn.springify()}
        exiting={isWeb ? undefined : ZoomOut.duration(150)}
        style={styles.shareModalContent}>
        <View style={styles.shareModalHeader}>
          <View>
            <Text style={styles.shareModalTitle}>{displayTitle}</Text>
            <Text style={styles.shareModalSubtitle}>Collaborate with other users</Text>
          </View>
          <Pressable onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <View style={styles.shareModalBody}>
          {/* Search Users */}
          <View style={styles.searchSection}>
            <Text style={styles.sectionLabel}>Add Collaborator</Text>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by email..."
                value={searchQuery}
                onChangeText={onSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((user) => (
                  <Pressable
                    key={user.id}
                    style={styles.userResultItem}
                    onPress={() => {
                      onAddCollaborator(user.id, 'edit');
                    }}>
                    <View style={styles.userAvatar}>
                      <Ionicons name="person" size={16} color={ACCENT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userResultName}>{user.name || user.email}</Text>
                      {user.name && <Text style={styles.userResultEmail}>{user.email}</Text>}
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Current Collaborators */}
          <View style={styles.collaboratorsSection}>
            <Text style={styles.sectionLabel}>Collaborators ({collaborators.length})</Text>
            {collaborators.length === 0 ? (
              <View style={styles.emptyCollaborators}>
                <Ionicons name="people-outline" size={32} color="#d1d5db" />
                <Text style={styles.emptyCollaboratorsText}>No collaborators yet</Text>
              </View>
            ) : (
              <View style={styles.collaboratorsList}>
                {collaborators.map((collab) => (
                  <View key={collab.id} style={styles.collaboratorItem}>
                    <View style={styles.userAvatar}>
                      <Ionicons name="person" size={16} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.collaboratorName}>
                        {collab.user_name || collab.user_email}
                      </Text>
                      <Text style={styles.collaboratorPermission}>
                        {collab.permission === 'edit' ? 'Can edit' : 'View only'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onRemoveCollaborator(collab.id)}
                      style={styles.removeButton}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={ACCENT} />
          </View>
        )}
      </Animated.View>
    </Animated.View>
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
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#4338ca',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    height: 44,
    width: 44,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
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
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'column',
    gap: 10,
    zIndex: 99999,
    minWidth: 220,
    maxWidth: 340,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 12,
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
    height: 140,
    minWidth: 170,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
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
    paddingVertical: 9,
    borderRadius: 12,
  },
  pillText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 14,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontWeight: '700',
    fontSize: 12,
  },
  notesHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    gap: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  notePreview: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  noteTimestamp: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  noteEditButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  // Premium Notes Page Styles
  notesContainer: {
    gap: 20,
  },
  // Ultra-Modern Header Styles
  ultraHeader: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    shadowColor: '#4338ca',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
    marginBottom: 8,
  },
  headerAnimatedBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  headerOrb: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  ultraTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.8)',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbIconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 61, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumbActive: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: -0.2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  liveDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10b981',
  },
  quickStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  statBubbleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  heroIconContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: ACCENT,
    opacity: 0.15,
  },
  heroIconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 61, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 61, 255, 0.2)',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  folderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  folderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  createButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: ACCENT,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  createButtonGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: ACCENT,
    opacity: 0.3,
    borderRadius: 34,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  createButtonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#ffffff',
    opacity: 0.15,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  headerBackdropBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  headerFloatingOrbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  floatingOrb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbPrimary: {
    width: 200,
    height: 200,
    top: -80,
    right: -60,
    backgroundColor: ACCENT,
    opacity: 0.05,
  },
  orbSecondary: {
    width: 150,
    height: 150,
    bottom: -50,
    left: -40,
    backgroundColor: '#f59e0b',
    opacity: 0.04,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumbText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 20,
    position: 'relative',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  headerIconWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#f1f5ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerIconGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: `linear-gradient(135deg, ${ACCENT} 0%, #6366f1 100%)`,
    opacity: 0.08,
  },
  headerIconGlow: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    borderRadius: 18,
    backgroundColor: ACCENT,
    opacity: 0.12,
    transform: [{ scale: 1.2 }],
  },
  headerIconBorder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.7,
  },
  headerTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#dcfce7',
  },
  headerTitleBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  headerTitleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerMetaBadge: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  metaBadgeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    opacity: 0.5,
  },
  headerMetaBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerMetaBadgeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  headerMetaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#cbd5e1',
  },
  headerTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLastUpdate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSearchButton: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  searchButtonGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: ACCENT,
    opacity: 0,
  },
  headerIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerIconButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  headerPrimaryButton: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: ACCENT,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  buttonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#6366f1',
    opacity: 0.15,
  },
  buttonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: '#fff',
    opacity: 0.15,
  },
  buttonGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: ACCENT,
    opacity: 0.2,
    borderRadius: 21,
  },
  buttonSparkle: {
    marginLeft: 4,
    opacity: 0.9,
  },
  headerPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: ACCENT,
    opacity: 0.15,
  },
  headerGradientBar: {
    position: 'relative',
    height: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  headerGradientFill: {
    height: '100%',
    backgroundColor: ACCENT,
    opacity: 0.7,
  },
  headerGradientGlow: {
    position: 'absolute',
    left: 0,
    top: -2,
    height: 8,
    width: '45%',
    backgroundColor: ACCENT,
    opacity: 0.3,
    shadowColor: ACCENT,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  filterSection: {
    marginTop: -4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: ACCENT,
  },
  filterChipIconBg: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipIconBgActive: {
    backgroundColor: ACCENT,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: ACCENT,
  },
  filterChipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  filterChipBadgeActive: {
    backgroundColor: ACCENT,
  },
  filterChipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  filterChipBadgeTextActive: {
    color: '#fff',
  },
  contentSection: {
    gap: 32,
  },
  // Ultra-Modern Folders Styles
  modernFoldersSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 61, 255, 0.1)',
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  ultraFoldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  ultraFolderCard: {
    position: 'relative',
    width: '32%',
    minWidth: 200,
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  ultraFolderCardActive: {
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  ultraFolderCardPressed: {
    transform: [{ scale: 0.97 }],
  },
  ultraFolderGradient: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  ultraFolderContent: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ultraFolderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ultraFolderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ultraFolderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ultraFolderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  sharedFolderIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#10b98110',
  },
  ultraFolderInfo: {
    gap: 6,
  },
  ultraFolderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  ultraFolderDate: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  ultraFolderActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: ACCENT,
  },
  // Ultra-Premium Notes Styles
  ultraLoadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ultraLoadingSpinner: {
    marginBottom: 16,
  },
  ultraLoadingText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  ultraNotesSection: {
    marginBottom: 32,
  },
  ultraSharedSection: {
    marginTop: 32,
  },
  ultraNotesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  ultraNoteCardWrapper: {
    width: '48%',
    minWidth: 300,
  },
  ultraNoteCard: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  ultraNoteCardPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: ACCENT,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  ultraNoteGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 20,
    opacity: 0,
    zIndex: -1,
  },
  ultraNoteTopBar: {
    height: 5,
    width: '100%',
  },
  ultraNoteContentWrapper: {
    padding: 20,
  },
  ultraNoteHeader: {
    marginBottom: 16,
  },
  ultraNoteTitleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ultraNoteIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ultraNoteTitleWrapper: {
    flex: 1,
    gap: 6,
  },
  ultraNoteTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  ultraNoteStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ultraStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ultraNoteStatus: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  ultraNotePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  ultraNotePreview: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    fontWeight: '400',
  },
  ultraNotePreviewFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: 'transparent',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  ultraNoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  ultraNoteMetaSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ultraNoteDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ultraNoteDateText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  ultraNoteCharBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ultraNoteCharText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  ultraNoteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ultraActionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ultraActionButtonPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: '#f1f5f9',
  },
  ultraNoteShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  foldersSection: {
    gap: 16,
  },
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  premiumFolderCard: {
    width: 180,
    height: 150,
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  folderCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    opacity: 0.4,
  },
  folderCardContent: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    opacity: 0.85,
  },
  premiumFolderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  folderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folderMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  folderDate: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  notesSection: {
    gap: 20,
  },
  notesList: {
    gap: 12,
  },
  premiumNoteCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    overflow: 'hidden',
  },
  noteCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: ACCENT,
    opacity: 0.7,
  },
  noteCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
  },
  noteIconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  noteIconBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: ACCENT,
    opacity: 0.08,
  },
  noteCardContent: {
    flex: 1,
    gap: 8,
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  premiumNoteTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  noteTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  noteTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumNotePreview: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 21,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  noteFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  premiumNoteTimestamp: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  noteWordCount: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  noteWordCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  noteCardRight: {
    marginLeft: 14,
  },
  premiumNoteEditButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noteDeleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  // Share Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 8,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  shareModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalCloseButton: {
    padding: 4,
  },
  shareModalBody: {
    padding: 20,
    gap: 24,
  },
  searchSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  searchResults: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  userResultEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
  collaboratorsSection: {
    gap: 12,
  },
  emptyCollaborators: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyCollaboratorsText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  collaboratorsList: {
    gap: 8,
  },
  collaboratorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    gap: 12,
  },
  collaboratorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  collaboratorPermission: {
    fontSize: 13,
    color: '#10b981',
  },
  removeButton: {
    padding: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  premiumEmptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#f1f5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyStateCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT,
    marginTop: 8,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  emptyStateCTAText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 99999,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    elevation: 20,
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
    overflow: 'visible',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    maxWidth: 980,
    alignSelf: 'center',
  },
  docsShell: {
    backgroundColor: '#e9eef5',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  docsTopbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  docsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  docsBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  docsBadgeText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  docsChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  docsChipText: {
    color: '#111827',
    fontWeight: '600',
  },
  docsToolbarRow: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 8,
  },
  docsButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  docsButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#e0e7ff',
  },
  docsButtonText: {
    fontWeight: '700',
    color: '#1f2937',
  },
  docsPageContainer: {
    backgroundColor: '#e5eaf1',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
    alignItems: 'center',
  },

  // Modern 2025 Note Card Styles
  modernNoteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    elevation: 2,
  },
  noteColorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  modernNoteContent: {
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 16,
  },
  modernNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modernNoteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modernNoteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernNoteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    letterSpacing: -0.2,
  },
  modernNoteMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  modernNoteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modernNoteMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  modernNotePreview: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    marginBottom: 14,
    letterSpacing: -0.1,
  },
  modernNoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modernNoteFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modernNoteDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  modernNoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modernActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modernActionBtnPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: '#f1f5f9',
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ACCENT + '30',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  searchResultsText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
    textAlign: 'center',
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  folderBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Ultra-Modern Search Bar Styles
  ultraSearchContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  ultraSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ACCENT + '25',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  ultraSearchIconBox: {
    position: 'relative',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT + '10',
    borderRadius: 10,
  },
  ultraSearchIconGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 10,
    opacity: 0.15,
  },
  ultraSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    paddingVertical: 4,
  },
  ultraSearchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ultraSearchResultsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: ACCENT + '15',
    borderRadius: 8,
  },
  ultraSearchResultsText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  ultraSearchClearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  ultraSearchHint: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ultraSearchHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  ultraSearchTips: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  ultraSearchTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  ultraSearchTipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  // Delete Confirmation Dialog Styles
  deleteConfirmCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  deleteConfirmIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deleteConfirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteConfirmMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteConfirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  deleteConfirmDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  overlayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  overlayCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  overlayCreateButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  overlayCreateButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  overlayCreateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  overlayCreateTextDisabled: {
    color: '#9ca3af',
  },
  iconPicker: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconPickerSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  colorPicker: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorPickerSelected: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  alertIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  alertIconSuccess: {
    backgroundColor: '#d1fae5',
  },
  alertIconError: {
    backgroundColor: '#fee2e2',
  },
  alertIconWarning: {
    backgroundColor: '#fef3c7',
  },
  alertIconInfo: {
    backgroundColor: '#dbeafe',
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  alertButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonSuccess: {
    backgroundColor: '#10b981',
  },
  alertButtonError: {
    backgroundColor: '#ef4444',
  },
  alertButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  alertButtonInfo: {
    backgroundColor: '#3b82f6',
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  ultraFolderTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderEditButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderEditButtonPressed: {
    backgroundColor: '#e2e8f0',
  },
  deleteFolderButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteFolderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  shareFolderButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  shareFolderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
