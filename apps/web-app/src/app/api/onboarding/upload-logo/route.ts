/**
 * ============================================================================
 * ONBOARDING UPLOAD LOGO API ROUTE
 * ============================================================================
 * 
 * Route Next.js pour l'upload du logo d'établissement
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const draftId = formData.get('draftId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      );
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed' },
        { status: 400 }
      );
    }

    // Créer le répertoire d'upload s'il n'existe pas
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'logos');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `logo-${draftId}-${timestamp}.${extension}`;
    const filepath = join(uploadsDir, filename);

    // Convertir le File en Buffer et sauvegarder
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Retourner l'URL publique du logo
    const logoUrl = `/uploads/logos/${filename}`;

    return NextResponse.json({
      success: true,
      logoUrl,
      filename,
    });
  } catch (error: any) {
    console.error('Upload logo error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload logo',
        message: error.message || 'Erreur lors de l\'upload du logo',
      },
      { status: 500 }
    );
  }
}
