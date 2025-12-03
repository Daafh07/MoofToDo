// app/(tabs)/index.tsx
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { TasksScreen } from "../TasksScreen";

type Session =
  Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];

export default function HomeTab() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auth initialiseren: kijken of er al een sessie is
  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setAuthLoading(false);

      supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });
    };

    initAuth();
  }, []);

  const handleSignUp = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.log("signup error:", error.message);
    }

    setAuthLoading(false);
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("login error:", error.message);
    }

    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Bezig met laden...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    // Geen user → login / register scherm
    return (
      <SafeAreaView
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>
          Planner login
        </Text>

        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            borderWidth: 1,
            padding: 10,
            borderRadius: 8,
            marginBottom: 8,
          }}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          placeholder="Wachtwoord"
          secureTextEntry
          style={{
            borderWidth: 1,
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
          value={password}
          onChangeText={setPassword}
        />

        <Button title="Inloggen" onPress={handleSignIn} />
        <View style={{ height: 8 }} />
        <Button title="Account aanmaken" onPress={handleSignUp} />
      </SafeAreaView>
    );
  }

  // Ingelogd → laat taken/planner scherm zien
  return <TasksScreen onSignOut={handleSignOut} />;
}