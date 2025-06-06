import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios'; // Import axios to mock it

import RecipeBrowser, { LanguageList, Player, RecipeRow, RecipeList } from './RecipeBrowser'; // Adjust if components are not exported directly for testing

// Mock axios
jest.mock('axios');

// Mock HTMLMediaElement play and pause methods (not implemented in JSDOM)
window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();
window.HTMLMediaElement.prototype.addEventListener = jest.fn();
window.HTMLMediaElement.prototype.removeEventListener = jest.fn();


// --- Test Suites & Cases will go here ---

// Helper function to create a mock recipe item
const createMockRecipeItem = (id, name = 'Test Recipe') => ({
    _id: id,
    url: `http://example.com/image${id}.jpg`,
    mp3: `http://example.com/audio${id}.mp3`,
    name: `${name} ${id}`,
    records: [
        { _id: `r${id}-1`, BlockType: "LINE", Text: "First source line", Translations: [{ TranslatedText: "First target line" }] },
        { _id: `r${id}-2`, BlockType: "LINE", Text: "Second source line", Translations: [{ TranslatedText: "Second target line" }] },
        { _id: `r${id}-3`, BlockType: "WORD", Text: "ignore", Translations: [{ TranslatedText: "ignorar" }] }, // Should be filtered out
        { _id: `r${id}-4`, BlockType: "LINE", Text: "S", Translations: [{ TranslatedText: "T" }] }, // Should be filtered out
    ],
});


describe('RecipeBrowser Component', () => {
    beforeEach(() => {
        // Clears any previous mock implementation details
        axios.get.mockReset();
        window.HTMLMediaElement.prototype.play.mockClear();
        window.HTMLMediaElement.prototype.pause.mockClear();
    });

    test('renders loading state initially', () => {
        axios.get.mockReturnValueOnce(new Promise(() => {})); // Pending promise
        render(<RecipeBrowser />);
        expect(screen.getByText(/Loading recipes.../i)).toBeInTheDocument();
    });

    test('renders error state on API failure', async () => {
        axios.get.mockRejectedValueOnce(new Error('Network Error'));
        render(<RecipeBrowser />);
        await waitFor(() => {
            expect(screen.getByText(/Error fetching recipes/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    });

    test('renders "No recipes found" when API returns empty data', async () => {
        axios.get.mockResolvedValueOnce({ data: { data: [] } });
        render(<RecipeBrowser />);
        await waitFor(() => {
            expect(screen.getByText(/No recipes found/i)).toBeInTheDocument();
        });
    });

    test('renders recipe list on successful API call', async () => {
        const mockData = { data: { data: [createMockRecipeItem('1'), createMockRecipeItem('2')] } };
        axios.get.mockResolvedValueOnce(mockData);
        render(<RecipeBrowser />);
        await waitFor(() => {
            // Check for parts of the RecipeRow rendering
            expect(screen.getByAltText(/Test Recipe 1/i)).toBeInTheDocument();
            expect(screen.getByAltText(/Test Recipe 2/i)).toBeInTheDocument();
            expect(screen.getAllByText(/First source line/i).length).toBeGreaterThan(0);
        });
    });
});

describe('RecipeList Component', () => {
    test('renders a list of recipes', () => {
        const items = { data: [createMockRecipeItem('1'), createMockRecipeItem('2')] };
        render(<RecipeList items={items} />);
        expect(screen.getByAltText(/Test Recipe 1/i)).toBeInTheDocument();
        expect(screen.getByAltText(/Test Recipe 2/i)).toBeInTheDocument();
    });
});

describe('RecipeRow Component', () => {
    const mockItem = createMockRecipeItem('1');
    test('renders recipe details correctly', () => {
        render(<RecipeRow item={mockItem} />);
        expect(screen.getByAltText(mockItem.name)).toBeInTheDocument();
        expect(screen.getByText('Uploaded Recipe')).toBeInTheDocument(); // Header
        expect(screen.getByText('Source Language: en')).toBeInTheDocument();
        expect(screen.getByText('Target Language: es')).toBeInTheDocument();
        // Check if LanguageList content is rendered (first lines)
        expect(screen.getByText('First source line')).toBeInTheDocument();
        expect(screen.getByText('First target line')).toBeInTheDocument();
        // Check for player button
        expect(screen.getByRole('button', { name: /Toggle audio playback for recipe/i })).toBeInTheDocument();
    });

    test('does not render player if mp3 url is missing', () => {
        const itemWithoutMp3 = { ...mockItem, mp3: null };
        render(<RecipeRow item={itemWithoutMp3} />);
        expect(screen.queryByRole('button', { name: /Toggle audio playback for recipe/i })).not.toBeInTheDocument();
    });
});

describe('Player Component', () => {
    const testUrl = 'http://example.com/test.mp3';

    test('renders Play button and toggles to Pause and back', () => {
        render(<Player url={testUrl} />);
        const button = screen.getByRole('button', { name: /Toggle audio playback for recipe/i });

        // Initial state: Play
        expect(button).toHaveTextContent('Play');
        expect(button).toHaveAttribute('aria-pressed', 'false');

        // Click to Play
        fireEvent.click(button);
        expect(button).toHaveTextContent('Pause');
        expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
        expect(button).toHaveAttribute('aria-pressed', 'true');

        // Click to Pause
        fireEvent.click(button);
        expect(button).toHaveTextContent('Play');
        expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });
});

describe('LanguageList Component', () => {
    const mockRecords = [
        { _id: '1', BlockType: "LINE", Text: "Hello world", Translations: [{ TranslatedText: "Hola mundo" }] },
        { _id: '2', BlockType: "LINE", Text: "This is a test", Translations: [{ TranslatedText: "Esto es una prueba" }] },
        { _id: '3', BlockType: "WORD", Text: "Word", Translations: [{ TranslatedText: "Palabra" }] }, // Should be filtered
        { _id: '4', BlockType: "LINE", Text: "S", Translations: [{ TranslatedText: "C" }] }, // Should be filtered (too short)
        { _id: '5', BlockType: "LINE", Text: null, Translations: [{ TranslatedText: "Nada" }] }, // Should be filtered (null text)
    ];

    test('renders list of phrases for source text', () => {
        render(<LanguageList records={mockRecords} textAccessor={phrase => phrase.Text} />);
        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.getByText('This is a test')).toBeInTheDocument();
        expect(screen.queryByText('Word')).not.toBeInTheDocument();
        expect(screen.queryByText('S')).not.toBeInTheDocument();
        expect(screen.queryByText('Nada')).not.toBeInTheDocument(); // Text is null
    });

    test('renders list of phrases for translated text', () => {
        render(<LanguageList records={mockRecords} textAccessor={phrase => phrase.Translations[0].TranslatedText} />);
        expect(screen.getByText('Hola mundo')).toBeInTheDocument();
        expect(screen.getByText('Esto es una prueba')).toBeInTheDocument();
        expect(screen.queryByText('Palabra')).not.toBeInTheDocument();
        expect(screen.queryByText('C')).not.toBeInTheDocument();
    });

    test('renders "No phrases to display" for empty or fully filtered records', () => {
        render(<LanguageList records={[]} textAccessor={phrase => phrase.Text} />);
        expect(screen.getByText('No phrases to display.')).toBeInTheDocument();

        render(<LanguageList records={mockRecords.slice(2, 4)} textAccessor={phrase => phrase.Text} />); // Only records that will be filtered
        expect(screen.getByText('No phrases to display.')).toBeInTheDocument();
    });
});
