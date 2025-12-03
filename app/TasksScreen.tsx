// app/TasksScreen.tsx
import { useEffect, useState } from "react";
import {
    Button,
    FlatList,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "./lib/supabase";

type Task = {
  id: string;
  title: string;
  description: string | null;
  is_done: boolean;
};

type Props = {
  onSignOut: () => void;
};

export function TasksScreen({ onSignOut }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  const fetchTasks = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("fetch error:", error.message);
    } else {
      setTasks(data as Task[]);
    }

    setLoading(false);
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("tasks").insert({
      title: newTitle,
      user_id: user?.id,
    });

    if (error) {
      console.log("insert error:", error.message);
      return;
    }

    setNewTitle("");
    fetchTasks();
  };

  const toggleTask = async (task: Task) => {
    const { error } = await supabase
      .from("tasks")
      .update({ is_done: !task.is_done })
      .eq("id", task.id);

    if (error) {
      console.log("update error:", error.message);
      return;
    }

    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.log("delete error:", error.message);
      return;
    }

    fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "600" }}>Mijn taken</Text>
        <Button title="Logout" onPress={onSignOut} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <TextInput
          placeholder="Nieuwe taak..."
          style={{
            flex: 1,
            borderWidth: 1,
            padding: 8,
            borderRadius: 8,
          }}
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <Button title="+" onPress={addTask} />
      </View>

      {loading ? (
        <Text>Bezig met laden...</Text>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                padding: 12,
                marginBottom: 8,
                borderRadius: 8,
                borderWidth: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <TouchableOpacity onPress={() => toggleTask(item)} style={{ flex: 1 }}>
                <Text
                  style={{
                    textDecorationLine: item.is_done ? "line-through" : "none",
                    fontSize: 16,
                  }}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
              <Button title="X" onPress={() => deleteTask(item.id)} />
            </View>
          )}
        />
      )}
    </View>
  );
}