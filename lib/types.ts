export type Category = { id: string; slug: string; name: string; sort: number };

export type Modifier = {
  id: string;
  category_id: string;
  text: string;
  favorite: number;
  usage_count: number;
  parent_id: string | null;
  archived: number;
  is_public: number;
  /** Imagen analizada de la que salió el modificador (solo si nació de "Analizar imagen"). */
  origin_file: string | null;
  created_at: number;
  /** Resultados más recientes generados con este modificador (miniaturas). */
  thumbs?: string[];
};

export type CommunityModifier = { id: string; text: string; category: string; usage_count: number };

export type GenerationModifier = { modifier_id: string; text: string };

export type Generation = {
  id: string;
  model: string;
  kind: "image" | "video";
  free_text: string | null;
  prompt: string;
  source_file: string | null;
  source_deleted_at: number | null;
  is_public: number;
  source_public: number;
  aspect_ratio: string | null;
  cost_usd: number | null;
  /** Tokens que se cobraron por esta generación (0 si falló o fue en modo desarrollo). */
  tokens_spent?: number | null;
  result_file: string | null;
  status: "processing" | "done" | "error";
  error: string | null;
  created_at: number;
  modifiers: GenerationModifier[];
};

/** Combinación guardada de modificadores y texto extra; la imagen es solo una portada. */
export type Preset = {
  id: string;
  name: string;
  free_text: string | null;
  ref_file: string | null;
  modifier_ids: string[];
  /** 1 = visible para la comunidad (otros pueden guardarlo en su biblioteca). */
  is_public: number;
  created_at: number;
};

export type CommunityPreset = {
  id: string;
  name: string;
  free_text: string | null;
  ref_file: string | null;
  modifiers: { text: string; category: string }[];
};
