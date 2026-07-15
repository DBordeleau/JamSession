export const SOURCE_ADMISSION_UNAVAILABLE_MESSAGE =
  "Audio uploads are unavailable during the prototype while Jam Session evaluates sustainable storage.";

export function sourceReservationErrorMessage(error: string | undefined) {
  return error === "audio_uploads_unavailable"
    ? SOURCE_ADMISSION_UNAVAILABLE_MESSAGE
    : (error ?? "Could not reserve storage.");
}
