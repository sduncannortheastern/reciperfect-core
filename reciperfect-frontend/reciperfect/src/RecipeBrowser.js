import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import './App.css';

/**
 * @typedef {object} PhraseRecord
 * @property {string} _id - Unique identifier for the phrase.
 * @property {string} BlockType - Type of block, e.g., "LINE".
 * @property {string} Text - The text content of the phrase.
 * @property {Array<{TranslatedText: string}>} Translations - Array of translations.
 */

/**
 * Displays a list of phrases in a specific language.
 * Filters phrases to include only lines with text length greater than 2.
 * @param {object} props - The component props.
 * @param {PhraseRecord[]} props.records - Array of phrase records to display.
 * @param {function(PhraseRecord): string} props.textAccessor - Function to access the text to be displayed from a phrase record.
 * @returns {JSX.Element} A list of phrases or a message if no phrases are available.
 */
const LanguageList = memo(function LanguageList({ records, textAccessor }) {
    if (!records || records.length === 0) {
        return <div className="language-list-empty">No phrases to display.</div>;
    }
    return (
        <div className="language-list" role="list">
            {records
                // Filter for lines that are actual text content
                .filter(phrase => phrase.BlockType === "LINE" && phrase.Text && phrase.Text.length > 2)
                .map(filteredPhrase => (
                    <div key={filteredPhrase._id} className="language-list-item" role="listitem">
                        {textAccessor(filteredPhrase)}
                    </div>
                ))}
        </div>
    );
});

LanguageList.propTypes = {
    records: PropTypes.arrayOf(PropTypes.shape({
        _id: PropTypes.string.isRequired,
        BlockType: PropTypes.string.isRequired,
        Text: PropTypes.string, // Text can sometimes be null or empty before filtering
        Translations: PropTypes.arrayOf(PropTypes.shape({
            TranslatedText: PropTypes.string.isRequired,
        })),
    })).isRequired,
    textAccessor: PropTypes.func.isRequired,
};


/**
 * Custom hook to manage audio playback.
 * @param {string} url - The URL of the audio file to play.
 * @returns {[boolean, function(): void]} A tuple containing:
 *  - `playing` (boolean): Current playback state.
 *  - `toggle` (function): Function to toggle playback.
 */
const useAudio = url => {
    // Initialize audio element with the given URL.
    // useState with a function ensures Audio is only created once.
    const [audio] = useState(() => new Audio(url));
    const [playing, setPlaying] = useState(false);

    // Toggles the playback state.
    const toggle = () => setPlaying(!playing);

    // Effect to handle play/pause logic and URL changes.
    useEffect(() => {
        // If the URL changes, update the audio source and stop current playback.
        if (audio.src !== url) {
            audio.src = url;
            setPlaying(false);
        }
        // Play or pause the audio based on the `playing` state.
        if (playing) {
            audio.play().catch(err => console.error("Error playing audio:", err)); // Added catch for play promise
        } else {
            audio.pause();
        }
    }, [playing, url, audio]); // Dependencies: re-run if playing state, URL, or audio object changes.

    // Effect to reset playing state when audio finishes.
    useEffect(() => {
        const handleEnded = () => setPlaying(false);
        audio.addEventListener('ended', handleEnded);
        // Cleanup: remove event listener when component unmounts or audio object changes.
        return () => {
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audio]); // Dependency: re-run if audio object changes.

    return [playing, toggle];
};

/**
 * Player component with a button to toggle audio playback.
 * @param {object} props - The component props.
 * @param {string} props.url - The URL of the audio file to play.
 * @returns {JSX.Element} A button to control audio playback.
 */
const Player = memo(function Player({ url }) {
    const [playing, toggle] = useAudio(url);

    return (
        <button
            onClick={toggle}
            className="player-button"
            aria-pressed={playing}
            aria-label="Toggle audio playback for recipe"
        >
            {playing ? "Pause" : "Play"}
        </button>
    );
});

Player.propTypes = {
    url: PropTypes.string.isRequired,
};

/**
 * @typedef {object} RecipeItemData
 * @property {string} _id - Unique identifier for the recipe.
 * @property {string} url - URL of the recipe image.
 * @property {string} [mp3] - Optional URL of the recipe audio.
 * @property {PhraseRecord[]} records - Array of phrase records for the recipe.
 * @property {string} [name] - Optional name/title of the recipe (for alt text).
 */

/**
 * Displays a single recipe item, including its visual, source text, translated text, and player.
 * @param {object} props - The component props.
 * @param {RecipeItemData} props.item - The recipe item data.
 * @returns {JSX.Element} A visual representation of a single recipe.
 */
const RecipeRow = memo(function RecipeRow({ item }) {
    // Alt text can be more descriptive if item.name or item.title is available.
    const altText = item.name ? `Visual of ${item.name}` : "Recipe visual";
    return (
        <div className="recipe-item" role="article">
            <div className="recipe-header">
                <h3 className="recipe-header-title">Uploaded Recipe</h3>
                <h3 className="recipe-header-title">Source Language: en</h3>
                <h3 className="recipe-header-title">Target Language: es</h3>
            </div>
            <div className="recipe-content">
                <div className="recipe-image-cell">
                    <img src={item.url} alt={altText} className="recipe-image" />
                </div>
                <div className="recipe-language-cell">
                    <LanguageList records={item.records} textAccessor={phrase => phrase.Text} />
                </div>
                <div className="recipe-language-cell">
                    {/* Ensure Translations array and its first element exist before accessing TranslatedText */}
                    <LanguageList records={item.records} textAccessor={phrase => phrase.Translations && phrase.Translations[0] ? phrase.Translations[0].TranslatedText : "No translation"} />
                </div>
                <div className="recipe-player-cell">
                    {item.mp3 && <Player url={item.mp3} />}
                </div>
            </div>
        </div>
    );
});

RecipeRow.propTypes = {
    item: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired,
        mp3: PropTypes.string,
        records: PropTypes.arrayOf(PropTypes.object).isRequired, // Using PropTypes.object for PhraseRecord as it's complex
        name: PropTypes.string,
    }).isRequired,
};

/**
 * Displays a list of recipe items.
 * @param {object} props - The component props.
 * @param {{data: RecipeItemData[]}} props.items - Object containing an array of recipe items.
 * @returns {JSX.Element} A list of recipe rows.
 */
function RecipeList({ items }) {
    return (
        <div className="recipe-list">
            {items.data.map(item => (
                <RecipeRow key={item._id} item={item} />
            ))}
        </div>
    );
}

RecipeList.propTypes = {
    items: PropTypes.shape({
        data: PropTypes.arrayOf(PropTypes.object).isRequired, // Using PropTypes.object for RecipeItemData
    }).isRequired,
};

/**
 * Main component for browsing recipes.
 * Fetches recipe data and handles loading and error states.
 * @returns {JSX.Element} The Recipe Browser UI.
 */
function RecipeBrowser() {
    const [items, setItems] = useState(null); // Holds the fetched recipe data.
    const [loading, setLoading] = useState(true); // True while data is being fetched.
    const [error, setError] = useState(null); // Holds error object if fetching fails.

    // Effect hook to fetch recipe records when the component mounts.
    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true); // Set loading true at the start of fetching.
            setError(null);   // Clear any previous errors.
            try {
                // Fetch data from the API.
                const response = await axios.get("http://localhost:5000/record");
                setItems(response); // Store the successfully fetched data.
            } catch (e) {
                console.error("Error fetching recipes:", e); // Log the error for debugging.
                setError(e); // Store the error object to display an error message.
            } finally {
                setLoading(false); // Set loading false once fetching is complete (success or failure).
            }
        };
        fetchRecords();
    }, []); // Empty dependency array means this effect runs only once on mount.

    // Display loading message.
    if (loading) {
        return <div className="status-message">Loading recipes...</div>;
    }

    // Display error message if fetching failed.
    if (error) {
        return <div className="status-message error-message">Error fetching recipes. Please try again later. Details: {error.message}</div>;
    }

    // Display message if no recipes are found.
    if (!items || !items.data || items.data.length === 0) {
        return <div className="status-message">No recipes found.</div>;
    }

    // Render the list of recipes.
    return (
        <div className="recipe-browser-container">
            <RecipeList items={items} />
        </div>
    );
}

// No PropTypes for RecipeBrowser as it doesn't take props.

// Export non-default components for testing purposes
export { LanguageList, Player, RecipeRow, RecipeList };
export default RecipeBrowser;