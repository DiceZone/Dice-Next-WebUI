/**
 * Deck type definitions.
 *
 * Card decks for tabletop gaming (e.g. tarot, poker, custom decks).
 */
export interface Deck {
    id: string;
    name: string;
    description: string;
    cardCount: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface DeckDetail extends Deck {
    cards: DeckCard[];
}
export interface DeckCard {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
}
export interface DeckFormData {
    name: string;
    description: string;
    cards: Omit<DeckCard, 'id'>[];
}
