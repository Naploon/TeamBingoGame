import { getAdminUser } from "@/lib/auth/admin";
import { AppError } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";
import { uploadTaskImage } from "@/lib/supabase/storage";

export async function POST(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const kindValue = formData.get("kind");
    const kind = kindValue === "template" ? "template" : "task";

    if (!(file instanceof File)) {
      throw new AppError("Please choose an image to upload.", 400);
    }

    const image = await uploadTaskImage(file, kind);
    return jsonOk({ image });
  } catch (error) {
    return jsonError(error);
  }
}
