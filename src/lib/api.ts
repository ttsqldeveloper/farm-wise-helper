import { supabase } from "@/integrations/supabase/client";

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  location?: string;
  cropTypes?: string[];
}

export const api = {
  // ---------- Auth ----------
  async register(body: RegisterPayload) {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: body.fullName,
          location: body.location ?? "",
          crop_types: body.cropTypes ?? [],
        },
      },
    });
    if (error) throw error;
    return { user: data.user };
  },

  async login(body: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword(body);
    if (error) throw error;
    return { user: data.user };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async me() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.user.id)
      .maybeSingle();
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      fullName: profile?.full_name ?? "",
      location: profile?.location ?? "",
      cropTypes: profile?.crop_types ?? [],
    };
  },

  async updateMe(body: { fullName?: string; location?: string; cropTypes?: string[] }) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: body.fullName,
        location: body.location,
        crop_types: body.cropTypes,
      })
      .eq("id", u.user.id);
    if (error) throw error;
  },

  async deleteMe() {
    // Sign out; account-level deletion typically needs a privileged endpoint.
    await supabase.auth.signOut();
  },

  // ---------- Plant disease prediction ----------
  async predict(file: File) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");

    // Upload to storage
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${u.user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("diagnosis-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("diagnosis-images").getPublicUrl(path);
    const imageUrl = pub.publicUrl;

    // Call edge function
    const { data, error } = await supabase.functions.invoke("diagnose-plant", {
      body: { imageUrl },
    });
    if (error) throw error;

    // Persist
    const { error: insErr } = await supabase.from("diagnoses").insert({
      user_id: u.user.id,
      image_url: imageUrl,
      prediction: data.prediction,
      confidence: data.confidence,
      recommendation: data.recommendation,
      raw: data,
    });
    if (insErr) console.warn("Failed to save diagnosis:", insErr);

    return { ...data, imageUrl };
  },

  // ---------- Chat ----------
  async chat(question: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");

    const { data, error } = await supabase.functions.invoke("farm-chat", {
      body: { question },
    });
    if (error) throw error;

    const answer = data?.answer ?? "";
    const { error: insErr } = await supabase
      .from("chats")
      .insert({ user_id: u.user.id, question, answer });
    if (insErr) console.warn("Failed to save chat:", insErr);

    return { answer };
  },

  // ---------- History ----------
  async diagnoses(limit = 50) {
    const { data, error } = await supabase
      .from("diagnoses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { items: data ?? [] };
  },

  async chats(limit = 50) {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { items: data ?? [] };
  },

  // ---------- Crops ----------
  async crops(search?: string) {
    let q = supabase.from("crops").select("*").order("crop_name");
    if (search) q = q.ilike("crop_name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return { items: data ?? [] };
  },
};
