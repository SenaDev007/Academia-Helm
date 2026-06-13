'use client';
import React from 'react';

/**
 * Hook pour détecter si la page a été scrollée au-delà d'un seuil donné.
 * Utilisé par le header pour activer l'effet backdrop-blur au scroll.
 */
export function useScroll(threshold: number) {
	const [scrolled, setScrolled] = React.useState(false);

	const onScroll = React.useCallback(() => {
		setScrolled(window.scrollY > threshold);
	}, [threshold]);

	React.useEffect(() => {
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, [onScroll]);

	// Vérifie au premier rendu
	React.useEffect(() => {
		onScroll();
	}, [onScroll]);

	return scrolled;
}
