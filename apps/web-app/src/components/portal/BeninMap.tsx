/**
 * ============================================================================
 * CARTE INTERACTIVE DU BÉNIN - BENINMAP
 * ============================================================================
 *
 * Carte SVG interactive des 12 départements du Bénin, fidèle au style
 * des sites gouvernementaux (emp.educmaster.bj / secondaire.educmaster.bj) :
 * - Layout côte-à-côte : carte SVG à gauche, panneau de détail fixe à droite
 * - Panneau toujours visible : totaux nationaux ou stats départementales
 * - Échelle discrète 6 niveaux (comme le site du secondaire)
 * - Filtres par cycle (Maternelle/CI-CP/CE/CM) et statut (Tous/Public/Privé)
 * - Tableau des circonscriptions scolaires (primaire uniquement)
 * - Légende avec bornes explicites
 *
 * Palette Academia Helm : Navy (#0b2f73) / Blue (#1d4fa5) / Gold (#f5b335)
 *
 * ============================================================================
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  GraduationCap,
  Users,
  School,
  X,
  BookOpen,
  ChevronDown,
  BarChart3,
  Building2,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  BENIN_DEPARTMENTS,
  BENIN_TOTALS,
  BENIN_SECONDAIRE_TOTALS,
  type DepartmentData,
} from '@/data/benin-departments';
import { useGovData } from '@/lib/hooks/use-gov-data';
import { useSchoolsMap, type SchoolPin } from '@/lib/hooks/use-schools-map';

/* ── Palette Academia Helm ────────────────────────────────────────────── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const NAVY_DARK = '#071d4a';
const GOLD_LIGHT = '#f7c76e';

/* ── Types ────────────────────────────────────────────────────────────── */
type FilterType = 'all' | 'public' | 'private';
type EducationLevel = 'primaire' | 'secondaire';
type PrimaireCycle = 'all' | 'maternelle' | 'ci_cp' | 'ce' | 'cm';

interface BeninMapProps {
  onDepartmentSelect?: (dept: DepartmentData | null) => void;
  selectedDepartment?: DepartmentData | null;
  filter?: FilterType;
  className?: string;
}

/* ── SVG Paths des 12 départements du Bénin (geoBoundaries ADM1, accurate) ── */
const DEPT_PATHS: Record<string, string> = {
  AL: 'M274.9,114.5 274.7,111.6 273.2,111.7 273.2,111.1 271.6,110.9 271.3,108.3 270.2,107.5 269.3,107.1 269.2,106.4 269.2,105.3 269.5,103.8 270.8,100.7 269.0,94.5 268.0,93.5 267.7,89.6 268.0,88.5 268.0,87.8 267.3,87.4 265.2,87.0 260.8,83.6 253.7,76.9 254.9,71.1 255.8,65.8 256.6,64.0 256.7,62.4 257.3,60.1 258.8,55.7 259.7,53.7 259.9,52.4 259.1,51.8 257.7,50.9 257.0,49.9 255.2,48.8 255.0,47.6 254.6,46.8 253.4,45.5 251.9,44.5 250.0,44.2 249.5,43.4 248.0,42.3 245.8,41.0 244.8,41.5 243.4,42.1 242.1,41.7 241.8,41.0 239.4,37.8 238.8,36.1 238.6,34.3 238.3,33.6 237.0,32.4 233.9,30.3 233.6,28.3 232.1,26.6 230.1,26.7 229.9,25.6 228.5,24.2 224.4,22.5 224.6,21.6 224.2,19.3 223.2,18.1 222.1,17.4 219.9,16.6 218.6,15.5 216.6,13.5 215.3,11.4 213.3,9.5 211.1,8.0 210.2,8.0 208.9,8.5 208.1,8.9 207.2,9.1 205.3,10.9 204.1,10.6 203.6,10.8 203.3,12.9 203.1,13.8 202.4,15.0 201.4,14.5 200.6,13.9 199.6,14.1 198.9,14.8 198.2,15.0 197.8,14.6 196.9,14.3 196.2,14.8 196.1,15.2 195.3,15.3 194.6,16.3 192.8,15.0 191.7,14.9 191.7,15.7 191.6,16.7 191.1,17.3 190.2,16.2 189.7,16.0 189.4,16.5 189.4,17.2 189.2,17.9 188.6,17.7 188.2,16.8 187.8,16.5 187.2,16.6 187.0,17.0 186.4,17.1 185.4,16.8 184.5,17.1 185.3,20.7 185.6,21.7 185.9,25.5 186.0,26.3 186.5,27.2 186.7,28.1 186.8,28.9 187.9,30.0 188.0,32.2 191.2,33.3 191.3,35.0 190.0,35.9 189.0,35.3 188.6,36.3 188.0,36.9 186.3,36.5 185.9,37.9 186.8,39.0 187.0,40.2 186.8,41.2 187.1,42.3 186.7,43.0 186.0,43.5 185.7,44.3 185.7,46.1 185.1,47.8 182.8,49.7 181.4,51.7 181.6,53.2 182.0,55.0 180.7,55.9 179.9,56.2 178.8,56.3 178.5,56.5 177.0,57.1 176.1,58.0 175.2,58.3 174.3,58.4 166.9,65.5 163.1,68.5 163.8,69.2 178.2,96.2 180.7,96.5 183.3,97.8 185.4,100.5 183.1,101.5 180.4,104.3 179.5,105.5 179.0,108.7 178.7,111.8 179.1,125.5 182.6,126.7 185.4,126.5 188.5,126.4 190.5,125.1 191.5,124.8 195.0,125.3 196.1,126.7 197.0,128.0 199.2,128.9 202.6,129.5 205.4,129.3 206.4,128.6 207.3,127.5 209.5,125.3 213.1,125.4 216.8,125.2 217.5,127.3 218.8,128.1 221.1,128.6 230.2,127.3 235.2,125.3 244.9,122.5 246.1,121.5 247.4,121.9 248.6,121.8 250.4,120.8 257.8,119.0 267.3,116.3 266.9,117.4 268.8,117.0 271.4,115.8 272.9,114.9 274.9,114.5 Z',
  AT: 'M179.1,125.5 178.7,111.8 179.0,108.7 179.5,105.5 180.4,104.3 183.1,101.5 185.4,100.5 183.3,97.8 180.7,96.5 178.2,96.2 163.8,69.2 163.1,68.5 156.0,68.0 155.0,67.1 153.3,67.2 151.7,67.8 149.7,67.6 149.1,68.0 147.9,68.2 147.0,68.6 145.6,68.8 144.5,68.3 143.0,68.9 141.4,69.8 138.5,70.6 136.1,70.4 135.8,69.7 135.1,68.4 134.2,67.7 132.7,66.9 131.2,67.1 130.5,66.6 129.7,67.0 128.6,66.9 127.0,66.1 126.3,66.2 123.5,67.9 122.8,68.9 123.1,70.0 122.9,71.1 122.4,71.8 120.8,71.9 119.8,72.5 119.0,73.3 118.3,74.0 119.4,75.0 120.4,76.1 119.6,77.0 118.0,77.5 116.3,76.6 115.9,76.1 114.5,76.0 114.0,76.5 114.5,77.3 115.1,77.8 115.6,78.5 115.5,79.4 114.6,80.2 113.9,80.0 112.7,79.2 111.5,79.5 109.0,79.7 109.0,79.6 108.0,78.7 107.4,79.1 106.6,79.6 106.8,81.0 107.6,81.9 108.1,83.1 108.6,84.5 108.6,85.5 107.7,85.9 106.5,85.1 105.8,85.4 104.7,86.4 102.1,87.6 102.3,88.3 102.9,88.0 103.6,88.2 103.6,89.1 104.6,90.1 105.4,92.3 106.1,92.7 106.6,93.3 106.4,93.8 105.9,94.0 104.4,92.9 103.1,92.5 101.9,92.8 100.7,92.8 99.4,91.6 98.2,91.1 96.4,91.3 96.5,92.4 95.8,93.2 95.1,94.3 95.2,95.4 95.9,96.1 93.1,96.8 91.5,101.6 92.4,103.9 91.1,104.9 90.7,108.8 86.4,113.4 86.0,114.3 86.5,121.1 86.0,123.1 84.9,125.9 84.8,133.7 121.1,157.3 121.4,157.7 121.7,158.1 135.6,157.3 138.2,156.7 140.6,155.4 142.3,154.4 144.1,151.6 148.5,150.9 149.5,151.9 151.6,153.4 153.6,153.1 156.7,153.2 158.4,153.3 160.4,153.0 161.9,153.1 163.3,152.9 165.1,153.4 166.6,153.4 168.4,153.4 168.5,153.2 170.3,153.3 173.6,153.3 176.8,152.2 178.5,151.2 179.9,148.9 179.8,147.7 179.4,145.7 178.4,142.8 177.6,140.8 175.9,137.4 174.5,136.6 173.8,134.6 173.5,133.3 174.4,130.6 175.9,128.3 178.5,126.9 179.0,125.4 179.1,125.5 Z',
  BO: 'M274.9,114.5 272.9,114.9 271.4,115.8 268.8,117.0 266.9,117.4 267.3,116.3 257.8,119.0 250.4,120.8 248.6,121.8 247.4,121.9 246.1,121.5 244.9,122.5 235.2,125.3 230.2,127.3 221.1,128.6 218.8,128.1 217.5,127.3 216.8,125.2 213.1,125.4 209.5,125.3 207.3,127.5 206.4,128.6 205.4,129.3 202.6,129.5 199.2,128.9 197.0,128.0 196.1,126.7 195.0,125.3 191.5,124.8 190.5,125.1 188.5,126.4 185.4,126.5 182.6,126.7 179.1,125.5 179.0,125.4 178.5,126.9 175.9,128.3 174.4,130.6 173.5,133.3 173.8,134.6 174.5,136.6 175.9,137.4 177.6,140.8 178.4,142.8 179.4,145.7 179.8,147.7 179.9,148.9 178.5,151.2 176.8,152.2 173.6,153.3 170.3,153.3 168.5,153.2 168.4,153.4 167.9,154.2 168.1,155.6 168.5,156.7 168.4,158.2 167.2,159.0 167.2,159.8 167.6,161.0 167.7,163.3 166.8,166.2 166.7,169.8 167.0,171.8 168.3,174.8 170.8,177.6 171.7,179.6 169.9,189.3 169.5,192.4 169.0,194.4 169.2,195.7 167.1,197.5 165.3,197.3 161.6,197.8 160.1,199.5 159.8,201.3 159.5,205.8 159.2,207.4 159.5,210.3 162.1,212.4 163.3,213.0 164.3,214.2 163.8,216.5 162.5,220.4 162.2,222.4 162.1,224.2 162.1,225.3 163.9,228.3 164.6,228.7 167.3,230.1 168.8,230.7 171.1,231.2 173.1,231.4 173.6,231.9 172.8,234.3 177.2,234.2 198.3,234.0 206.4,233.8 206.2,232.8 206.5,232.1 207.2,231.6 207.8,231.3 207.9,230.5 207.5,229.7 207.5,228.6 208.4,227.0 208.8,226.1 208.4,225.3 207.9,224.6 208.7,223.7 208.4,223.1 209.1,217.9 208.9,216.3 209.6,215.0 214.6,215.2 215.6,214.8 216.5,213.9 218.6,213.7 220.0,213.7 220.9,214.3 222.3,214.8 224.5,214.2 227.1,213.6 228.4,212.7 229.0,211.2 229.4,209.8 230.4,207.6 231.6,203.4 232.5,202.3 233.2,200.4 232.5,197.1 232.5,195.5 232.2,193.9 231.4,191.5 232.3,189.5 233.4,187.8 234.6,187.3 236.5,184.4 238.2,182.2 238.5,181.6 238.3,180.7 238.4,179.6 239.0,178.9 240.2,178.4 241.2,178.2 242.3,178.2 243.4,177.9 244.2,177.3 244.6,176.5 243.4,172.5 243.4,170.2 244.3,168.8 244.6,168.1 246.7,167.2 247.8,166.6 248.8,166.5 250.4,165.4 252.0,165.1 253.4,164.3 254.3,164.4 255.3,164.6 260.5,157.4 261.0,154.6 261.2,151.5 261.4,150.7 261.9,150.1 262.6,149.4 263.8,148.8 264.3,148.0 264.8,146.0 264.9,144.9 264.7,143.9 264.4,143.4 263.8,143.3 262.6,142.8 261.7,142.1 261.2,141.4 261.0,140.7 260.8,140.3 260.7,139.9 259.1,138.6 262.4,132.2 262.5,130.2 262.8,129.9 264.5,128.9 265.2,128.0 266.4,127.8 267.6,128.4 268.2,128.8 269.8,129.1 270.8,129.6 271.6,129.0 272.4,127.4 273.0,125.8 272.7,123.5 273.6,121.7 273.8,120.8 274.5,119.7 275.2,118.4 274.9,114.5 Z',
  DO: 'M168.4,153.4 166.6,153.4 165.1,153.4 163.3,152.9 161.9,153.1 160.4,153.0 158.4,153.3 156.7,153.2 153.6,153.1 151.6,153.4 149.5,151.9 148.5,150.9 144.1,151.6 142.3,154.4 140.6,155.4 138.2,156.7 135.6,157.3 121.7,158.1 121.4,157.7 121.1,160.3 121.5,165.7 122.2,167.9 122.1,169.4 121.7,170.9 121.9,172.9 121.8,175.6 122.2,177.9 122.3,179.6 121.5,181.8 120.7,183.0 120.5,185.0 121.1,186.1 121.5,187.6 122.1,188.5 122.5,188.1 123.3,188.3 124.4,197.0 125.1,198.6 129.5,204.5 132.0,206.6 134.4,209.2 135.3,210.9 136.4,212.6 136.5,214.4 137.1,216.3 137.0,221.2 137.5,229.2 137.1,242.1 137.4,243.3 137.6,244.5 139.8,244.7 143.8,244.4 146.7,243.5 148.0,243.1 150.4,243.9 152.7,245.7 154.4,247.1 156.9,247.2 158.3,248.0 160.0,249.8 161.7,250.8 163.5,251.8 165.4,251.9 167.2,252.5 168.7,252.7 170.8,252.9 172.4,252.3 173.4,251.7 174.0,251.2 173.6,250.3 173.1,248.5 174.0,246.7 173.8,241.2 173.3,240.0 172.7,237.0 172.3,235.8 172.3,234.6 172.8,234.3 173.6,231.9 173.1,231.4 171.1,231.2 168.8,230.7 167.3,230.1 164.6,228.7 163.9,228.3 162.1,225.3 162.1,224.2 162.2,222.4 162.5,220.4 163.8,216.5 164.3,214.2 163.3,213.0 162.1,212.4 159.5,210.3 159.2,207.4 159.5,205.8 159.8,201.3 160.1,199.5 161.6,197.8 165.3,197.3 167.1,197.5 169.2,195.7 169.0,194.4 169.5,192.4 169.9,189.3 171.7,179.6 170.8,177.6 168.3,174.8 167.0,171.8 166.7,169.8 166.8,166.2 167.7,163.3 167.6,161.0 167.2,159.8 167.2,159.0 168.4,158.2 168.5,156.7 168.1,155.6 167.9,154.2 168.4,153.4 Z',
  CO: 'M172.8,234.3 172.3,234.6 172.3,235.8 172.7,237.0 173.3,240.0 173.8,241.2 174.0,246.7 173.1,248.5 173.6,250.3 174.0,251.2 173.4,251.7 172.4,252.3 170.8,252.9 168.7,252.7 167.2,252.5 165.4,251.9 163.5,251.8 161.7,250.8 160.0,249.8 158.3,248.0 156.9,247.2 154.4,247.1 152.7,245.7 150.4,243.9 148.0,243.1 146.7,243.5 143.8,244.4 139.8,244.7 137.6,244.5 137.4,243.3 137.3,243.2 137.1,244.5 137.4,247.0 139.4,250.0 138.6,251.7 137.7,253.1 137.4,255.7 137.1,256.5 137.1,257.9 137.7,258.6 138.0,265.4 138.0,275.9 137.8,286.1 138.2,291.7 138.5,293.8 138.0,295.0 138.3,300.6 138.3,302.8 142.1,303.4 145.0,303.3 155.2,305.3 159.6,307.1 161.8,307.8 165.6,309.8 169.4,310.6 171.4,310.8 173.2,311.1 174.9,311.2 176.0,311.7 177.2,312.1 179.6,313.2 181.4,315.1 181.9,315.5 183.5,315.9 185.1,315.6 185.9,315.3 186.8,315.0 187.3,313.9 188.5,311.9 189.6,311.3 190.2,310.6 190.6,309.9 190.5,308.7 190.1,307.3 190.2,306.4 190.4,305.6 190.8,304.8 191.1,303.7 200.0,303.3 205.8,303.0 206.2,293.3 205.6,292.7 204.8,292.0 204.2,290.7 203.5,289.7 203.0,288.1 203.9,285.9 204.0,282.8 204.3,279.9 204.7,277.7 205.3,276.2 205.2,273.0 206.3,271.4 206.5,270.7 206.8,269.3 206.8,268.2 206.1,266.9 205.3,265.3 204.4,262.4 204.4,259.2 205.4,255.0 206.5,253.2 207.1,251.5 207.3,250.0 207.1,248.3 207.2,246.1 207.1,244.3 206.9,242.7 206.8,241.4 206.5,240.6 206.8,240.1 206.7,239.3 207.0,237.4 206.7,236.9 206.4,233.8 198.3,234.0 177.2,234.2 172.8,234.3 Z',
  AQ: 'M165.9,349.1 166.2,350.2 166.6,351.0 166.6,351.9 165.4,352.4 165.3,353.1 165.4,354.6 164.8,355.8 163.9,356.8 163.1,359.3 163.2,360.7 162.8,362.0 161.7,364.0 162.0,364.4 162.4,365.1 162.3,365.7 161.7,366.5 160.9,367.3 160.5,368.2 160.5,369.1 160.5,370.4 160.7,371.6 161.0,372.6 160.8,373.5 160.8,375.2 160.4,377.4 160.0,378.8 159.5,379.9 159.0,381.4 159.0,382.6 159.7,384.3 160.1,385.0 160.4,386.2 160.9,386.8 160.9,387.4 161.0,388.0 161.2,389.5 170.1,388.2 174.1,387.9 181.5,386.5 181.5,386.3 181.4,386.1 181.5,385.3 183.2,381.2 184.8,380.9 185.9,380.2 188.4,379.4 189.2,379.3 190.1,379.4 190.5,379.5 190.5,379.0 190.7,378.3 190.8,377.4 190.6,375.6 190.6,374.9 189.8,374.3 189.2,374.0 188.5,373.7 187.7,373.3 188.0,370.6 187.6,368.7 187.2,359.4 186.6,353.6 186.3,352.4 186.0,351.5 185.3,350.8 183.9,349.1 183.9,348.5 186.1,345.0 186.2,344.9 185.9,344.3 185.7,343.9 185.2,343.7 184.2,343.6 183.7,344.2 183.1,344.9 181.5,346.6 180.3,344.7 177.4,346.7 167.6,348.8 166.4,349.0 165.9,349.1 Z',
  KO: 'M139.0,310.6 139.0,312.4 138.7,313.7 138.6,323.3 138.8,332.6 138.9,341.9 139.0,343.2 137.7,343.3 135.6,343.3 133.6,342.3 133.2,342.5 133.6,343.6 134.4,346.2 134.8,347.1 135.4,348.1 136.3,348.8 136.5,348.7 136.8,350.0 136.6,350.6 136.8,352.0 136.4,354.5 136.9,354.9 137.2,355.6 137.3,356.2 138.0,357.7 138.0,358.3 137.8,358.9 137.3,359.3 136.9,359.9 138.0,360.0 140.2,359.3 141.9,358.7 143.5,357.7 145.8,357.3 148.2,356.7 149.9,356.7 151.7,356.6 153.0,357.3 154.4,358.3 154.9,359.7 155.6,361.1 157.4,361.8 161.7,364.0 162.8,362.0 163.2,360.7 163.1,359.3 163.9,356.8 164.8,355.8 165.4,354.6 165.3,353.1 165.4,352.4 166.6,351.9 166.6,351.0 166.2,350.2 165.9,349.1 164.8,349.4 163.6,350.2 162.6,349.9 161.3,348.4 160.3,347.0 159.0,345.0 158.3,344.4 156.5,341.9 155.2,340.3 153.7,337.9 152.5,335.4 152.5,334.6 152.4,333.7 151.8,331.8 151.2,331.2 150.3,330.6 149.9,329.8 149.8,328.8 149.2,328.1 148.4,327.6 147.6,326.2 147.0,325.7 145.6,325.0 145.3,324.1 145.6,322.8 144.7,321.3 142.9,316.7 141.7,314.1 140.6,311.9 139.4,310.9 139.0,310.6 Z',
  LI: 'M181.4,386.1 181.5,386.3 182.7,386.2 185.1,386.1 186.5,385.9 187.5,385.5 188.8,385.4 190.2,384.9 192.4,384.4 194.0,384.2 195.0,384.0 193.4,382.2 192.7,381.2 192.1,380.6 190.9,379.9 190.5,379.5 190.5,379.5 190.1,379.4 189.2,379.3 188.4,379.4 185.9,380.2 184.8,380.9 183.2,381.2 181.5,385.3 181.4,386.1 Z',
  MO: 'M136.9,359.9 136.4,360.0 136.0,360.3 136.2,360.8 136.1,361.3 135.8,361.7 135.6,362.4 136.6,363.4 137.5,364.9 137.6,365.4 137.5,366.2 137.9,366.8 137.7,367.5 138.0,368.3 139.0,368.3 139.3,368.6 139.6,369.2 140.3,369.6 141.1,369.4 141.3,369.8 141.4,370.6 142.1,371.1 142.8,371.4 142.8,372.4 143.1,373.5 143.0,374.4 143.5,375.2 144.9,375.3 145.6,375.9 146.3,376.7 146.5,377.4 146.5,378.1 146.8,378.6 147.5,379.2 147.4,379.9 148.3,382.2 148.8,384.5 149.4,386.3 149.5,388.0 149.7,388.9 147.6,389.3 142.7,389.9 141.7,390.2 140.6,390.2 139.5,390.9 139.9,392.0 141.1,391.9 142.2,391.7 143.2,391.5 144.0,391.2 147.6,391.3 150.8,390.3 152.5,390.4 153.3,390.2 153.9,389.8 161.2,389.5 161.2,389.5 161.0,388.0 160.9,387.4 160.9,386.8 160.4,386.2 160.1,385.0 159.7,384.3 159.0,382.6 159.5,379.9 160.0,378.8 160.4,377.4 160.8,375.2 160.8,373.5 161.0,372.6 160.7,371.6 160.5,370.4 160.5,369.1 160.5,368.2 160.9,367.3 161.7,366.5 162.3,365.7 162.4,365.1 162.0,364.4 161.7,364.0 157.4,361.8 155.6,361.1 154.9,359.7 154.4,358.3 153.0,357.3 151.7,356.6 149.9,356.7 148.2,356.7 145.8,357.3 143.5,357.7 141.9,358.7 140.2,359.3 138.0,360.0 136.9,359.9 Z',
  OU: 'M194.1,344.8 193.1,344.6 186.2,344.9 186.2,344.9 186.1,345.0 183.9,348.5 183.9,349.1 185.3,350.8 186.0,351.5 186.3,352.4 186.6,353.6 187.2,359.4 187.6,368.7 188.0,370.6 187.7,373.3 188.5,373.7 189.2,374.0 189.8,374.3 190.6,374.9 190.6,375.6 190.8,377.4 190.7,378.3 190.5,379.0 190.5,379.5 190.5,379.5 190.9,379.9 192.1,380.6 192.7,381.2 193.4,382.2 195.0,384.0 196.6,383.6 198.0,383.4 204.8,381.7 204.9,380.2 204.7,376.5 205.1,374.9 205.4,373.3 205.7,370.8 204.8,370.3 200.3,370.1 199.9,369.8 199.5,368.3 197.7,361.5 193.9,353.4 193.1,350.8 193.3,348.3 193.8,345.4 194.1,344.8 Z',
  PL: 'M185.9,315.3 186.1,317.0 187.1,317.8 187.2,320.2 187.2,322.4 189.5,330.1 190.1,330.9 191.1,331.7 192.2,331.9 193.3,332.9 193.0,335.0 193.9,337.3 194.2,339.1 194.6,341.6 194.5,343.9 194.1,344.8 193.8,345.4 193.3,348.3 193.1,350.8 193.9,353.4 197.7,361.5 199.5,368.3 199.9,369.8 200.3,370.1 204.8,370.3 205.7,370.8 206.0,370.3 206.4,367.3 205.9,366.1 206.6,363.2 207.0,362.4 207.6,362.0 208.9,362.1 209.4,360.8 207.9,356.6 206.8,356.7 206.0,355.9 205.7,354.6 206.0,353.2 206.5,352.2 206.3,351.1 206.3,349.9 206.5,349.3 206.6,347.7 205.7,346.6 205.0,346.2 205.4,343.8 205.9,342.5 206.5,341.8 208.1,340.7 209.1,339.8 208.1,339.0 207.5,338.6 206.7,337.4 206.4,336.4 207.0,335.3 207.7,334.7 208.0,333.3 208.0,331.1 208.0,328.1 207.3,326.5 207.2,323.5 207.3,321.1 207.1,318.5 207.5,317.1 208.4,316.9 209.2,316.5 209.5,315.8 209.9,313.4 209.9,312.5 209.6,311.6 208.3,310.9 207.7,310.4 207.6,309.6 207.3,309.0 206.3,308.4 205.9,307.3 205.8,303.0 200.0,303.3 191.1,303.7 190.8,304.8 190.4,305.6 190.2,306.4 190.1,307.3 190.5,308.7 190.6,309.9 190.2,310.6 189.6,311.3 188.5,311.9 187.3,313.9 186.8,315.0 185.9,315.3 Z',
  ZO: 'M138.3,302.8 138.8,310.6 139.0,310.6 139.4,310.9 140.6,311.9 141.7,314.1 142.9,316.7 144.7,321.3 145.6,322.8 145.3,324.1 145.6,325.0 147.0,325.7 147.6,326.2 148.4,327.6 149.2,328.1 149.8,328.8 149.9,329.8 150.3,330.6 151.2,331.2 151.8,331.8 152.4,333.7 152.5,334.6 152.5,335.4 153.7,337.9 155.2,340.3 156.5,341.9 158.3,344.4 159.0,345.0 160.3,347.0 161.3,348.4 162.6,349.9 163.6,350.2 164.8,349.4 165.9,349.1 166.4,349.0 167.6,348.8 177.4,346.7 180.3,344.7 181.5,346.6 183.1,344.9 183.7,344.2 184.2,343.6 185.2,343.7 185.7,343.9 185.9,344.3 186.2,344.9 186.2,344.9 193.1,344.6 194.1,344.8 194.5,343.9 194.6,341.6 194.2,339.1 193.9,337.3 193.0,335.0 193.3,332.9 192.2,331.9 191.1,331.7 190.1,330.9 189.5,330.1 187.2,322.4 187.2,320.2 187.1,317.8 186.1,317.0 185.9,315.3 185.1,315.6 183.5,315.9 181.9,315.5 181.4,315.1 179.6,313.2 177.2,312.1 176.0,311.7 174.9,311.2 173.2,311.1 171.4,310.8 169.4,310.6 165.6,309.8 161.8,307.8 159.6,307.1 155.2,305.3 145.0,303.3 142.1,303.4 138.3,302.8 Z',
};

/* ── Positions des labels (centroïdes géographiques) ───────────────────── */
const DEPT_LABELS: Record<string, { x: number; y: number }> = {
  AL: { x: 216, y: 60 },
  AT: { x: 132, y: 101 },
  BO: { x: 217, y: 169 },
  DO: { x: 153, y: 201 },
  CO: { x: 177, y: 272 },
  AQ: { x: 174, y: 367 },
  KO: { x: 148, y: 344 },
  LI: { x: 188, y: 383 },
  MO: { x: 149, y: 374 },
  OU: { x: 193, y: 366 },
  PL: { x: 201, y: 334 },
  ZO: { x: 168, y: 329 },
};

/* ── Discrete color scale (6 levels, matching government site style) ──── */
const COLOR_SCALE = [
  '#c6dbef', // Level 1 — lightest
  '#6baed6', // Level 2
  '#3182bd', // Level 3
  '#1d4fa5', // Level 4 — Academia Helm Blue
  '#0b2f73', // Level 5 — Academia Helm Navy
  '#071d4a', // Level 6 — darkest
];

/**
 * Assign a color from the 6-level discrete scale based on value and breakpoints.
 * Breakpoints are computed dynamically from quintiles of the data.
 */
function getDiscreteColor(value: number, breakpoints: number[]): string {
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    if (value >= breakpoints[i]) return COLOR_SCALE[i];
  }
  return COLOR_SCALE[0];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

/* ── Animation variants ──────────────────────────────────────────────── */
const panelVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const panelTransition = { duration: 0.3, ease: 'easeOut' as const };

/* ── Composant principal ──────────────────────────────────────────────── */
export default function BeninMap({
  onDepartmentSelect,
  selectedDepartment,
  filter = 'all',
  className = '',
}: BeninMapProps) {
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [hoveredPin, setHoveredPin] = useState<SchoolPin | null>(null);
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('primaire');
  const [primaireCycle, setPrimaireCycle] = useState<PrimaireCycle>('all');
  const [circumscriptionOpen, setCircumscriptionOpen] = useState(false);

  /* ── Données gouvernementales en temps réel ─────────────────────────── */
  const govData = useGovData();

  /* ── Écoles inscrites sur Academia Helm ─────────────────────────────── */
  const { pins: schoolPins } = useSchoolsMap();

  // Utiliser les données live si disponibles, sinon les données statiques
  const departments = govData.departments;
  const primaireTotals = govData.primaireTotals;
  const secondaireTotals = govData.secondaireTotals;

  /* ── Get the school count for a department based on current filters ── */
  const getSchoolCount = useCallback(
    (dept: DepartmentData) => {
      if (educationLevel === 'secondaire') {
        return filter === 'public'
          ? dept.secondaire.publicCount
          : filter === 'private'
            ? dept.secondaire.privateCount
            : dept.secondaire.schoolCount;
      }
      // Primaire — cycle filter doesn't change total count (no per-cycle breakdown in data)
      return filter === 'public'
        ? dept.publicCount
        : filter === 'private'
          ? dept.privateCount
          : dept.schoolCount;
    },
    [educationLevel, filter],
  );

  /* ── Compute breakpoints for 6-level discrete scale (like gov site) ── */
  const breakpoints = useMemo(() => {
    const values = departments.map((d) => getSchoolCount(d)).sort(
      (a, b) => a - b,
    );
    const n = values.length;
    return [
      values[0],
      values[Math.floor(n / 6)],
      values[Math.floor((2 * n) / 6)],
      values[Math.floor((3 * n) / 6)],
      values[Math.floor((4 * n) / 6)],
      values[Math.floor((5 * n) / 6)],
    ];
  }, [getSchoolCount]);

  const maxSchools = useMemo(
    () => Math.max(...departments.map(getSchoolCount)),
    [getSchoolCount, departments],
  );

  const getFilterLabel = useCallback(() => {
    const levelLabel =
      educationLevel === 'secondaire' ? 'Secondaire' : 'Primaire';
    switch (filter) {
      case 'public':
        return `publics · ${levelLabel}`;
      case 'private':
        return `privés · ${levelLabel}`;
      default:
        return `tous statuts · ${levelLabel}`;
    }
  }, [filter, educationLevel]);

  const activeDept =
    selectedDepartment ??
    (hoveredDept
      ? departments.find((d) => d.code === hoveredDept)
      : null);

  const getActiveData = useCallback(
    (dept: DepartmentData) => {
      if (educationLevel === 'secondaire') {
        return {
          schoolCount: dept.secondaire.schoolCount,
          studentCount: dept.secondaire.studentCount,
          teacherCount: dept.secondaire.teacherCount,
          femalePercent: dept.secondaire.femalePercent,
          publicCount: dept.secondaire.publicCount,
          privateCount: dept.secondaire.privateCount,
        };
      }
      return {
        schoolCount: dept.schoolCount,
        studentCount: dept.studentCount,
        teacherCount: dept.teacherCount,
        femalePercent: dept.femalePercent,
        publicCount: dept.publicCount,
        privateCount: dept.privateCount,
      };
    },
    [educationLevel],
  );

  /* ── National totals based on current education level ── */
  const nationalTotals = useMemo(() => {
    if (educationLevel === 'secondaire') {
      const t = secondaireTotals;
      const femalePercent =
        t.students > 0
          ? Math.round(
              (departments.reduce(
                (s, d) => s + d.secondaire.studentCount * (d.secondaire.femalePercent / 100),
                0,
              ) /
                t.students) *
                100 *
                10,
            ) / 10
          : 0;
      return {
        schoolCount: t.schools,
        studentCount: t.students,
        teacherCount: t.teachers,
        femalePercent,
        publicCount: t.publicCount,
        privateCount: t.privateCount,
      };
    }
    const t = primaireTotals;
    const femalePercent =
      t.students > 0
        ? Math.round(
            (departments.reduce(
              (s, d) => s + d.studentCount * (d.femalePercent / 100),
              0,
            ) /
              t.students) *
              100 *
              10,
          ) / 10
        : 0;
    return {
      schoolCount: t.schools,
      studentCount: t.students,
      teacherCount: t.teachers,
      femalePercent,
      publicCount: t.publicCount,
      privateCount: t.privateCount,
    };
  }, [educationLevel, departments, primaireTotals, secondaireTotals]);

  /* ── Caption text (like government site) ── */
  const captionText = useMemo(() => {
    const entityLabel = educationLevel === 'secondaire' ? 'établissements' : 'écoles';
    const yearSuffix = govData.academicYear ? ` · ${govData.academicYear}` : '';
    return `Carte : nombre d'${entityLabel} par département · ${getFilterLabel()}${yearSuffix}`;
  }, [educationLevel, getFilterLabel, govData.academicYear]);

  /* ── The selected department for the panel ── */
  const panelDept = selectedDepartment ?? null;

  return (
    <div className={className}>
      {/* ── Level tabs: Primaire / Secondaire ─────────────────────── */}
      <div className="flex items-center gap-1 mb-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-0.5">
        {([
          {
            key: 'primaire' as const,
            label: 'Maternel & Primaire',
            shortLabel: 'Primaire',
            icon: BookOpen,
          },
          {
            key: 'secondaire' as const,
            label: 'Secondaire',
            shortLabel: 'Secondaire',
            icon: GraduationCap,
          },
        ] as const).map(({ key, label, shortLabel, icon: LvlIcon }) => (
          <button
            key={key}
            onClick={() => {
              setEducationLevel(key);
              setPrimaireCycle('all');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              educationLevel === key
                ? 'text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
            }`}
            style={
              educationLevel === key
                ? { background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }
                : undefined
            }
          >
            <LvlIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        ))}
      </div>

      {/* ── Primaire cycle sub-tabs (when primaire is active) ──── */}
      {educationLevel === 'primaire' && (
        <div className="flex items-center gap-1 mb-3">
          {([
            { key: 'all' as const, label: 'Tous' },
            { key: 'maternelle' as const, label: 'Maternelle' },
            { key: 'ci_cp' as const, label: 'CI-CP' },
            { key: 'ce' as const, label: 'CE' },
            { key: 'cm' as const, label: 'CM' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPrimaireCycle(key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${
                primaireCycle === key
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
              style={
                primaireCycle === key
                  ? { backgroundColor: BLUE }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Main layout: Map + Detail Panel side by side ────────── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── LEFT: SVG Map + Legend ──────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <svg
              viewBox="0 0 360 400"
              className="w-full max-w-2xl mx-auto"
              role="img"
              aria-label="Carte interactive du Bénin par département"
              onMouseLeave={() => setHoveredDept(null)}
            >
              {/* Départements */}
              {departments.map((dept) => {
                const path = DEPT_PATHS[dept.code];
                if (!path) return null;
                const value = getSchoolCount(dept);
                const isHovered = hoveredDept === dept.code;
                const isSelected = selectedDepartment?.code === dept.code;
                const isActive = isHovered || isSelected;

                return (
                  <g key={dept.code}>
                    <path
                      d={path}
                      fill={getDiscreteColor(value, breakpoints)}
                      stroke={isActive ? GOLD : 'rgba(255,255,255,0.7)'}
                      strokeWidth={isActive ? 2.5 : 1}
                      className="cursor-pointer transition-all duration-150"
                      style={{
                        outline: 'none',
                        filter: isActive
                          ? 'drop-shadow(0 2px 8px rgba(245,179,53,0.5))'
                          : 'none',
                      }}
                      onMouseEnter={() => setHoveredDept(dept.code)}
                      onMouseLeave={() => setHoveredDept(null)}
                      onClick={() =>
                        onDepartmentSelect?.(isSelected ? null : dept)
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`Département ${dept.name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onDepartmentSelect?.(isSelected ? null : dept);
                        }
                      }}
                    />
                    {/* Label du département */}
                    <text
                      x={DEPT_LABELS[dept.code]?.x ?? 0}
                      y={DEPT_LABELS[dept.code]?.y ?? 0}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      fill={isActive ? GOLD : 'rgba(255,255,255,0.92)'}
                      fontSize={isActive ? '8' : '6.5'}
                      fontWeight={isActive ? '700' : '600'}
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
                    >
                      {dept.name.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* Hover info overlay inside SVG */}
              {hoveredDept &&
                (() => {
                  const dept = departments.find(
                    (d) => d.code === hoveredDept,
                  );
                  if (!dept) return null;
                  const data = getActiveData(dept);
                  const lx = DEPT_LABELS[dept.code]?.x ?? 180;
                  const ly = (DEPT_LABELS[dept.code]?.y ?? 200) - 28;

                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={lx - 68}
                        y={ly - 20}
                        width={136}
                        height={22}
                        rx={6}
                        fill="rgba(7,29,74,0.92)"
                        stroke={GOLD}
                        strokeWidth={0.5}
                      />
                      <text
                        x={lx}
                        y={ly - 5}
                        textAnchor="middle"
                        fill="white"
                        fontSize="7.5"
                        fontWeight="600"
                      >
                        {dept.name} — {formatNumber(data.schoolCount)}{' '}
                        {educationLevel === 'secondaire' ? 'étab.' : 'écoles'}
                      </text>
                    </g>
                  );
                })()}

              {/* ── School Pins (écoles inscrites Academia Helm) ────────── */}
              {/* Définition du logo pin réutilisable (logo Academia Helm sans fond) */}
              <defs>
                <filter id="pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0.8" stdDeviation="1.2" floodColor="rgba(0,0,0,0.35)" />
                </filter>
                <filter id="pin-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="0.5" stdDeviation="2" floodColor="rgba(245,179,53,0.7)" />
                </filter>
              </defs>

              {schoolPins.length > 0 && schoolPins.map((pin) => {
                const isHovered = hoveredPin?.id === pin.id;
                const pinR = 9; // rayon du logo pin

                return (
                  <g
                    key={pin.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPin(pin)}
                    onMouseLeave={() => setHoveredPin(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {/* Pulse ring animation */}
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={pinR + 2}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth={0.8}
                      opacity={0.6}
                    >
                      <animate
                        attributeName="r"
                        from={pinR}
                        to={pinR + 6}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.6"
                        to="0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* Logo Academia Helm SVG comme pin (sans fond blanc) */}
                    <image
                      href="/images/logo-Academia-Helm.svg"
                      x={pin.x - pinR}
                      y={pin.y - pinR}
                      width={pinR * 2}
                      height={pinR * 2}
                      preserveAspectRatio="xMidYMid meet"
                      className="pointer-events-none select-none"
                      style={{
                        outline: 'none',
                        transition: 'filter 0.2s ease',
                        filter: isHovered ? 'url(#pin-glow)' : 'url(#pin-shadow)',
                      }}
                    />
                  </g>
                );
              })}

              {/* ── Hologram tooltip for hovered school pin ──────────────── */}
              {hoveredPin && (() => {
                const pin = hoveredPin;
                const tipW = 140;
                const tipH = 62;
                // Position tooltip above or below the pin depending on space
                const tipAbove = pin.y > tipH + 15;
                const tipX = Math.max(5, Math.min(pin.x - tipW / 2, 360 - tipW - 5));
                const tipY = tipAbove ? pin.y - tipH - 14 : pin.y + 18;

                return (
                  <g className="pointer-events-none">
                    {/* Backdrop glow */}
                    <rect
                      x={tipX - 2}
                      y={tipY - 2}
                      width={tipW + 4}
                      height={tipH + 4}
                      rx={8}
                      fill="rgba(245,179,53,0.08)"
                    />
                    {/* Main card */}
                    <rect
                      x={tipX}
                      y={tipY}
                      width={tipW}
                      height={tipH}
                      rx={6}
                      fill="rgba(7,29,74,0.95)"
                      stroke={GOLD}
                      strokeWidth={0.8}
                    />
                    {/* Gold top accent line */}
                    <rect
                      x={tipX + 6}
                      y={tipY + 1}
                      width={tipW - 12}
                      height={1.2}
                      rx={0.6}
                      fill={GOLD}
                      opacity={0.7}
                    />

                    {/* School name */}
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 14}
                      textAnchor="middle"
                      fill="white"
                      fontSize="7"
                      fontWeight="700"
                    >
                      {pin.name.length > 22 ? pin.name.slice(0, 21) + '…' : pin.name}
                    </text>

                    {/* City */}
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 24}
                      textAnchor="middle"
                      fill={GOLD}
                      fontSize="5.5"
                      fontWeight="500"
                    >
                      {pin.city || 'Bénin'}
                    </text>

                    {/* Separator */}
                    <line
                      x1={tipX + 10}
                      y1={tipY + 29}
                      x2={tipX + tipW - 10}
                      y2={tipY + 29}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={0.5}
                    />

                    {/* School type badge */}
                    <rect
                      x={tipX + 12}
                      y={tipY + 34}
                      width={tipW - 24}
                      height={11}
                      rx={3}
                      fill={BLUE}
                      opacity={0.7}
                    />
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 42}
                      textAnchor="middle"
                      fill="white"
                      fontSize="5.5"
                      fontWeight="600"
                    >
                      {pin.schoolType || 'École partenaire'}
                    </text>

                    {/* "Sur Academia Helm" label */}
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 55}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontSize="4.5"
                      fontWeight="400"
                    >
                      Sur Academia Helm
                    </text>

                    {/* Arrow pointing to pin */}
                    {tipAbove ? (
                      <polygon
                        points={`${pin.x - 4},${tipY + tipH} ${pin.x},${tipY + tipH + 6} ${pin.x + 4},${tipY + tipH}`}
                        fill="rgba(7,29,74,0.95)"
                        stroke={GOLD}
                        strokeWidth={0.5}
                      />
                    ) : (
                      <polygon
                        points={`${pin.x - 4},${tipY} ${pin.x},${tipY - 6} ${pin.x + 4},${tipY}`}
                        fill="rgba(7,29,74,0.95)"
                        stroke={GOLD}
                        strokeWidth={0.5}
                      />
                    )}
                  </g>
                );
              })()}
            </svg>

            {/* ── Legend (discrete, like government site) ──────────── */}
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                <span className="text-slate-500">Moins</span>
                {COLOR_SCALE.map((color, i) => (
                  <div
                    key={i}
                    className="h-3.5 w-7 rounded-sm border border-white/40"
                    style={{ backgroundColor: color }}
                    title={`≥ ${formatNumber(breakpoints[i])}`}
                  />
                ))}
                <span className="text-slate-500">Plus</span>
              </div>
              <p className="text-center text-[10px] text-slate-400 italic">
                {captionText}
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Detail Panel (always visible) ───────────────── */}
        <div className="w-full lg:w-[290px] lg:flex-shrink-0">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-lg overflow-hidden">
            <AnimatePresence mode="wait">
              {panelDept ? (
                /* ── DEPARTMENT SELECTED: Show department stats ───── */
                <motion.div
                  key={panelDept.code}
                  variants={panelVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={panelTransition}
                >
                  {/* En-tête département — dark navy gradient */}
                  <div
                    className="px-4 py-3.5 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                    }}
                  >
                    <div
                      className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10"
                      style={{ backgroundColor: GOLD }}
                    />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <p
                          className="text-[10px] font-medium uppercase tracking-wider"
                          style={{ color: GOLD_LIGHT }}
                        >
                          Département
                        </p>
                        <h3 className="mt-0.5 text-base font-bold text-white leading-tight">
                          {panelDept.name}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-blue-200 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {panelDept.capital} · {formatNumber(panelDept.area)} km²
                        </p>
                      </div>
                      <button
                        onClick={() => onDepartmentSelect?.(null)}
                        className="rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Fermer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Statistiques principales — inline stat cards */}
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Écoles */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <School className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">Écoles</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {formatNumber(getActiveData(panelDept).schoolCount)}
                        </p>
                      </div>
                      {/* Apprenants */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Users className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">Apprenants</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {formatNumber(getActiveData(panelDept).studentCount)}
                        </p>
                      </div>
                      {/* Enseignants */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <GraduationCap className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">Enseignants</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {formatNumber(getActiveData(panelDept).teacherCount)}
                        </p>
                      </div>
                      {/* % Filles */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <BarChart3 className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">% Filles</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {getActiveData(panelDept).femalePercent}%
                        </p>
                      </div>
                    </div>

                    {/* Répartition Public / Privé */}
                    <div className="rounded-xl bg-slate-50 p-2.5 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Répartition Public / Privé
                      </p>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700">Public</span>
                          <span className="text-slate-500">
                            {formatNumber(getActiveData(panelDept).publicCount)} (
                            {(
                              (getActiveData(panelDept).publicCount /
                                getActiveData(panelDept).schoolCount) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: NAVY }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${
                                (getActiveData(panelDept).publicCount /
                                  getActiveData(panelDept).schoolCount) *
                                100
                              }%`,
                            }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700">Privé</span>
                          <span className="text-slate-500">
                            {formatNumber(getActiveData(panelDept).privateCount)} (
                            {(
                              (getActiveData(panelDept).privateCount /
                                getActiveData(panelDept).schoolCount) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: GOLD }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${
                                (getActiveData(panelDept).privateCount /
                                  getActiveData(panelDept).schoolCount) *
                                100
                              }%`,
                            }}
                            transition={{
                              duration: 0.6,
                              ease: 'easeOut',
                              delay: 0.1,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Circonscriptions scolaires (primaire only) */}
                    {educationLevel === 'primaire' &&
                      panelDept.circumscriptions.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                          <button
                            onClick={() =>
                              setCircumscriptionOpen(!circumscriptionOpen)
                            }
                            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wide hover:bg-slate-50 transition-colors"
                            style={{ color: NAVY }}
                          >
                            <span className="flex items-center gap-1.5">
                              <MapPin
                                className="h-3 w-3"
                                style={{ color: GOLD }}
                              />
                              Circonscriptions ({panelDept.circumscriptions.length})
                            </span>
                            <motion.div
                              animate={{ rotate: circumscriptionOpen ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            </motion.div>
                          </button>
                          <AnimatePresence>
                            {circumscriptionOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="max-h-52 overflow-y-auto">
                                  <table className="w-full text-[10px]">
                                    <thead>
                                      <tr
                                        className="border-t border-slate-100"
                                        style={{ background: `${NAVY}08` }}
                                      >
                                        <th className="text-left px-2 py-1.5 font-semibold text-slate-600">
                                          CS
                                        </th>
                                        <th className="text-right px-2 py-1.5 font-semibold text-slate-600">
                                          Éc.
                                        </th>
                                        <th className="text-right px-2 py-1.5 font-semibold text-slate-600">
                                          App.
                                        </th>
                                        <th className="text-right px-2 py-1.5 font-semibold text-slate-600">
                                          Ens.
                                        </th>
                                        <th className="text-right px-2 py-1.5 font-semibold text-slate-600">
                                          %F
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {panelDept.circumscriptions.map((circ, i) => (
                                        <tr
                                          key={circ.name}
                                          className={`border-t border-slate-50 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}
                                        >
                                          <td className="px-2 py-1 font-medium text-slate-800">
                                            {circ.name}
                                          </td>
                                          <td
                                            className="text-right px-2 py-1 font-semibold"
                                            style={{ color: NAVY }}
                                          >
                                            {formatNumber(circ.schoolCount)}
                                          </td>
                                          <td className="text-right px-2 py-1 text-slate-600">
                                            {formatNumber(circ.studentCount)}
                                          </td>
                                          <td className="text-right px-2 py-1 text-slate-600">
                                            {formatNumber(circ.teacherCount)}
                                          </td>
                                          <td className="text-right px-2 py-1">
                                            <span
                                              className="font-medium"
                                              style={{
                                                color:
                                                  circ.femalePercent >= 48
                                                    ? '#16a34a'
                                                    : '#dc2626',
                                              }}
                                            >
                                              {circ.femalePercent}%
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                    {/* Communes */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        Communes ({panelDept.communes.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {panelDept.communes.map((commune) => (
                          <span
                            key={commune}
                            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                            style={{
                              backgroundColor: `${NAVY}08`,
                              border: `1px solid ${NAVY}18`,
                            }}
                          >
                            <MapPin
                              className="h-2.5 w-2.5"
                              style={{ color: BLUE }}
                            />
                            {commune}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Source */}
                    <p className="text-[9px] text-slate-400 text-center pt-1">
                      Source :{' '}
                      {educationLevel === 'primaire'
                        ? 'MEMP — emp.educmaster.bj'
                        : 'MESTFP — secondaire.educmaster.bj'}{' '}
                      · 2025-2026
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* ── NO DEPARTMENT: National totals + department list ── */
                <motion.div
                  key="national"
                  variants={panelVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={panelTransition}
                >
                  {/* En-tête national — dark navy gradient */}
                  <div
                    className="px-4 py-3.5 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY})`,
                    }}
                  >
                    <div
                      className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10"
                      style={{ backgroundColor: GOLD }}
                    />
                    <div className="relative">
                      <p
                        className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ color: GOLD_LIGHT }}
                      >
                        République du Bénin
                      </p>
                      <h3 className="mt-0.5 text-base font-bold text-white leading-tight">
                        Statistiques Nationales
                      </h3>
                      <p className="mt-0.5 text-[11px] text-blue-200 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {departments.length} départements ·{' '}
                        {educationLevel === 'secondaire' ? 'Secondaire' : 'Primaire'}
                        {' · '}
                        {govData.isLive ? (
                          <span className="flex items-center gap-0.5 text-emerald-300">
                            <Wifi className="h-2.5 w-2.5" />
                            <span className="text-[9px]">Live</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-amber-300">
                            <WifiOff className="h-2.5 w-2.5" />
                            <span className="text-[9px]">Cache</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* National stats — inline stat cards */}
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Écoles */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <School className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">
                            {educationLevel === 'secondaire' ? 'Étab.' : 'Écoles'}
                          </span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {formatNumber(nationalTotals.schoolCount)}
                        </p>
                      </div>
                      {/* Apprenants */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Users className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">Apprenants</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {formatNumber(nationalTotals.studentCount)}
                        </p>
                      </div>
                      {/* Enseignants */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <GraduationCap className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">Enseignants</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {formatNumber(nationalTotals.teacherCount)}
                        </p>
                      </div>
                      {/* % Filles */}
                      <div
                        className="rounded-lg p-2.5 border border-slate-100"
                        style={{
                          background: `linear-gradient(135deg, ${BLUE}08, ${BLUE}03)`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <BarChart3 className="h-3.5 w-3.5" style={{ color: BLUE }} />
                          <span className="text-[10px] text-slate-500">% Filles</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: BLUE }}>
                          {nationalTotals.femalePercent}%
                        </p>
                      </div>
                    </div>

                    {/* Répartition Public / Privé */}
                    <div className="rounded-xl bg-slate-50 p-2.5 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Répartition Public / Privé
                      </p>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700">Public</span>
                          <span className="text-slate-500">
                            {formatNumber(nationalTotals.publicCount)} (
                            {(
                              (nationalTotals.publicCount /
                                nationalTotals.schoolCount) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: NAVY }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${
                                (nationalTotals.publicCount /
                                  nationalTotals.schoolCount) *
                                100
                              }%`,
                            }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700">Privé</span>
                          <span className="text-slate-500">
                            {formatNumber(nationalTotals.privateCount)} (
                            {(
                              (nationalTotals.privateCount /
                                nationalTotals.schoolCount) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: GOLD }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${
                                (nationalTotals.privateCount /
                                  nationalTotals.schoolCount) *
                                100
                              }%`,
                            }}
                            transition={{
                              duration: 0.6,
                              ease: 'easeOut',
                              delay: 0.1,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Clickable list of all 12 departments */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        Départements
                      </p>
                      <div className="space-y-0.5">
                        {departments.map((dept) => {
                          const value = getSchoolCount(dept);
                          const color = getDiscreteColor(value, breakpoints);
                          return (
                            <button
                              key={dept.code}
                              onClick={() => onDepartmentSelect?.(dept)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors group"
                            >
                              <div
                                className="h-3 w-3 rounded-sm flex-shrink-0 border border-white/40"
                                style={{ backgroundColor: color }}
                              />
                              <span className="flex-1 text-[11px] font-medium text-slate-700 group-hover:text-slate-900">
                                {dept.name}
                              </span>
                              <span
                                className="text-[11px] font-bold"
                                style={{ color: BLUE }}
                              >
                                {formatNumber(value)}
                              </span>
                              <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Source */}
                    <p className="text-[9px] text-slate-400 text-center pt-1">
                      Source :{' '}
                      {educationLevel === 'primaire'
                        ? 'MEMP — emp.educmaster.bj'
                        : 'MESTFP — secondaire.educmaster.bj'}{' '}
                      · 2025-2026
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
