import JSZip from 'jszip';
import type { Note, Notebook } from '@tuxnotas/shared';

export async function getNoteContentAsText(doc: any, noteId: string): Promise<string> {
  const fragment = doc.getXmlFragment(`note-${noteId}`);
  const lines: string[] = [];
  const walk = (node: any) => {
    if (node.toString) {
      const str = node.toString();
      // strip XML tags to get plain text
      const plain = str.replace(/<[^>]+>/g, '').trim();
      if (plain) lines.push(plain);
    }
    if (node.toArray) {
      for (const child of node.toArray()) walk(child);
    }
  };
  walk(fragment);
  return lines.join('\n');
}

export async function exportNoteAs(doc: any, note: Note, format: 'txt' | 'md') {
  const content = await getNoteContentAsText(doc, note.id);
  let output = '';
  let ext = format;
  if (format === 'md') {
    output = `# ${note.title || 'Sin título'}\n\n${content}`;
  } else {
    output = `${note.title || 'Sin título'}\n${'='.repeat((note.title || 'Sin título').length)}\n\n${content}`;
  }
  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title || 'nota'}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAllPoolAsZip(doc: any, notes: Note[], notebooks: Notebook[], poolName: string) {
  const zip = new JSZip();
  const root = zip.folder(poolName) || zip;

  // Group notes by notebook
  const nbMap = new Map<string | undefined, Note[]>();
  for (const n of notes) {
    const key = n.notebookId;
    if (!nbMap.has(key)) nbMap.set(key, []);
    nbMap.get(key)!.push(n);
  }

  const nbNameMap = new Map<string, string>();
  for (const nb of notebooks) nbNameMap.set(nb.id, nb.name);

  for (const [nbId, nbNotes] of nbMap.entries()) {
    const folderName = nbId ? (nbNameMap.get(nbId) || 'Cuaderno') : 'Sin cuaderno';
    const folder = root.folder(folderName) || root;
    for (const note of nbNotes) {
      const content = await getNoteContentAsText(doc, note.id);
      const md = `# ${note.title || 'Sin título'}\n\n${content}`;
      folder.file(`${note.title || 'nota'}.md`, md);
      folder.file(`${note.title || 'nota'}.txt`, `${note.title || 'Sin título'}\n\n${content}`);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${poolName}-export.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportNoteToService(doc: any, note: Note, serviceUrl: string) {
  const content = await getNoteContentAsText(doc, note.id);
  const payload = {
    title: note.title || 'Sin título',
    content
  };

  const apiKey = import.meta.env.VITE_EXPORT_API_KEY || 'briefly-secret-key';

  try {
    const res = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Error en el servicio: ${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'nota'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exportando nota mediante microservicio:', error);
    throw error;
  }
}

