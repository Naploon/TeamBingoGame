import { randomUUID } from "node:crypto";

import { AppError } from "@/lib/game/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TASK_IMAGES_BUCKET = "task-images";
const MAX_TASK_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "bin";
}

export function validateTaskImageUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new AppError("Task image must be an image file.");
  }

  if (file.size > MAX_TASK_IMAGE_SIZE_BYTES) {
    throw new AppError("Task image must be 10 MB or smaller.");
  }
}

async function ensureTaskImagesBucket() {
  const supabase = createSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new AppError(listError.message);
  }

  if (buckets.some((bucket) => bucket.name === TASK_IMAGES_BUCKET)) {
    return supabase;
  }

  const { error: createError } = await supabase.storage.createBucket(TASK_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_TASK_IMAGE_SIZE_BYTES}`,
    allowedMimeTypes: ["image/*"],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new AppError(createError.message);
  }

  return supabase;
}

export async function uploadTaskImage(file: File, kind: "task" | "template" = "task") {
  validateTaskImageUpload(file);

  const supabase = await ensureTaskImagesBucket();
  const extension = getFileExtension(file.name);
  const path = `${kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(TASK_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });

  if (uploadError) {
    throw new AppError(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(TASK_IMAGES_BUCKET).getPublicUrl(path);

  return {
    imagePath: path,
    imageUrl: publicUrl,
  };
}
