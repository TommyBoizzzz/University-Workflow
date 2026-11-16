import { apiRequest } from "./apiClient.js";

export async function getDocumentBriefs() {
  const data = await apiRequest("/api/documents");
  return data.documents;
}

export async function createDocumentBrief({ file, topic }) {
  const formData = new FormData();
  formData.append("file", file);
  if (topic.trim()) formData.append("topic", topic.trim());
  return apiRequest("/api/documents/brief", {
    method: "POST",
    body: formData
  });
}
