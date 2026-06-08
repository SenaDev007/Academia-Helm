/**
 * ============================================================================
 * STUDENT PHOTO UPLOAD API ROUTE
 * ============================================================================
 * 
 * Upload d'une photo d'élève, stockage en fichier et retour d'une URL publique.
 * Inspiré de la route d'upload du logo établissement.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Taille max 3 Mo
    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 3 Mo)' },
        { status: 400 },
      );
    }

    // Uniquement images
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Type de fichier invalide. Seules les images sont autorisées.' },
        { status: 400 },
      );
    }

    // Dossier d'upload scoped par année pour éviter les collisions massives
    const year = new Date().getFullYear();
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'students', String(year));
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `student-${timestamp}.${extension}`;
    const filepath = join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const photoUrl = `/uploads/students/${year}/${filename}`;

    return NextResponse.json({
      success: true,
      photoUrl,
      filename,
    });
  } catch (error: any) {
    console.error('Upload student photo error:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de l\'upload de la photo',
        message: error.message || 'Upload de la photo impossible',
      },
      { status: 500 },
    );
  }
}

