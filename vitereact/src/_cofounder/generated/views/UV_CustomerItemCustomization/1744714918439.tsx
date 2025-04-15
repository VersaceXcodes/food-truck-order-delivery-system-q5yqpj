import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import {
    add_cart_item,
    set_cart_truck_name,
    add_notification,
    RootState,
    CartItem,
    CartItemOption
} from '@/store/main'; // Assuming store exports are structured like this

// Define interfaces based on expected data structures from backend/architecture
interface ModifierOption {
    option_uid: string;
    option_name: string;
    price_adjustment: number;
}

interface ModifierGroup {
    group_uid: string;
    group_name: string;
    selection_type: 'single' | 'multiple';
    is_required: boolean;
    options: ModifierOption[];
}

interface ItemDetailsProp {
    item_uid: string;
    item_name: string;
    description: string | null;
    base_price: number;
    modifier_groups: ModifierGroup[];
}

interface UV_CustomerItemCustomizationProps {
    itemDetails: ItemDetailsProp | null; // Allow null initially or if loading fails
    truckUid: string;
    truckName: string;
    onClose: () => void; // Callback to close the modal/view
}

type SelectedOptions = Record<string, string | string[]>;
type ValidationErrors = Record<string, string>;

const UV_CustomerItemCustomization: React.FC<UV_CustomerItemCustomizationProps> = ({
    itemDetails,
    truckUid,
    truckName,
    onClose
}) => {
    const dispatch = useDispatch();
    const cartMetadata = useSelector((state: RootState) => state.cart.cart_metadata);

    const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
    const [currentQuantity, setCurrentQuantity] = useState<number>(1);
    const [specialInstructionsInput, setSpecialInstructionsInput] = useState<string>("");
    const [calculatedItemTotal, setCalculatedItemTotal] = useState<number>(0);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    // --- Price Calculation Logic ---
    const calculate_total = useCallback(() => {
        if (!itemDetails) return 0;

        let options_total = 0;
        for (const group_uid in selectedOptions) {
            const group = itemDetails.modifier_groups.find(g => g.group_uid === group_uid);
            if (!group) continue;

            const selected = selectedOptions[group_uid];
            if (Array.isArray(selected)) { // Multiple choice
                selected.forEach(option_uid => {
                    const option = group.options.find(o => o.option_uid === option_uid);
                    if (option) {
                        options_total += option.price_adjustment;
                    }
                });
            } else if (selected) { // Single choice
                const option = group.options.find(o => o.option_uid === selected);
                if (option) {
                    options_total += option.price_adjustment;
                }
            }
        }

        const price_per_item = itemDetails.base_price + options_total;
        return price_per_item * currentQuantity;

    }, [itemDetails, selectedOptions, currentQuantity]);

    // --- Effects ---
    useEffect(() => {
        // Initialize state when itemDetails changes
        if (itemDetails) {
            setSelectedOptions({});
            setCurrentQuantity(1);
            setSpecialInstructionsInput("");
            setValidationErrors({});
            setCalculatedItemTotal(itemDetails.base_price * 1); // Initial calculation
        }
    }, [itemDetails]);

    useEffect(() => {
        // Recalculate total whenever dependencies change
        setCalculatedItemTotal(calculate_total());
    }, [selectedOptions, currentQuantity, calculate_total]);


    // --- Event Handlers ---

    const handle_option_change = (group_uid: string, option_uid: string, selection_type: 'single' | 'multiple') => {
        setSelectedOptions(prev => {
            const new_selection = { ...prev };
            if (selection_type === 'single') {
                new_selection[group_uid] = option_uid;
            } else { // multiple
                const current_group_selection = (new_selection[group_uid] as string[]) || [];
                const index = current_group_selection.indexOf(option_uid);
                if (index > -1) {
                    // Uncheck: Remove option
                    new_selection[group_uid] = current_group_selection.filter(uid => uid !== option_uid);
                } else {
                    // Check: Add option
                    new_selection[group_uid] = [...current_group_selection, option_uid];
                }
                // If array becomes empty, remove the key? Optional, but cleaner.
                if ((new_selection[group_uid] as string[]).length === 0) {
                    delete new_selection[group_uid];
                }
            }
            return new_selection;
        });
        // Clear validation error for this group on change
        setValidationErrors(prev => {
            const new_errors = { ...prev };
            delete new_errors[group_uid];
            return new_errors;
        });
    };

    const handle_quantity_change = (e: React.ChangeEvent<HTMLInputElement>) => {
        let new_quantity = parseInt(e.target.value, 10);
        if (isNaN(new_quantity) || new_quantity < 1) {
            new_quantity = 1;
        }
        setCurrentQuantity(new_quantity);
    };

    const increment_quantity = () => {
        setCurrentQuantity(prev => prev + 1);
    };

    const decrement_quantity = () => {
        setCurrentQuantity(prev => Math.max(1, prev - 1)); // Ensure quantity doesn't go below 1
    };

    const handle_special_instructions_change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setSpecialInstructionsInput(e.target.value);
    };

    const validate_and_add_to_cart = () => {
        if (!itemDetails) return;

        const errors: ValidationErrors = {};
        itemDetails.modifier_groups.forEach(group => {
            if (group.is_required) {
                const selection = selectedOptions[group.group_uid];
                if (!selection || (Array.isArray(selection) && selection.length === 0)) {
                    errors[group.group_uid] = `${group.group_name} is required.`;
                }
            }
        });

        setValidationErrors(errors);

        if (Object.keys(errors).length === 0) {
            // Validation passed, construct cart item

            const cart_item_options: CartItemOption[] = [];
            for (const group_uid in selectedOptions) {
                const group = itemDetails.modifier_groups.find(g => g.group_uid === group_uid);
                if (!group) continue;

                const selected_ids = Array.isArray(selectedOptions[group_uid])
                    ? (selectedOptions[group_uid] as string[])
                    : [selectedOptions[group_uid] as string];

                selected_ids.forEach(option_uid => {
                    const option = group.options.find(o => o.option_uid === option_uid);
                    if (option) {
                        cart_item_options.push({
                            option_uid: option.option_uid,
                            modifier_group_name_snapshot: group.group_name,
                            option_name_snapshot: option.option_name,
                            price_adjustment_snapshot: option.price_adjustment,
                        });
                    }
                });
            }

            const new_cart_item: CartItem = {
                cart_item_id: uuidv4(),
                menu_item_uid: itemDetails.item_uid,
                food_truck_uid: truckUid,
                item_name_snapshot: itemDetails.item_name,
                quantity: currentQuantity,
                base_price_snapshot: itemDetails.base_price,
                total_item_price: calculatedItemTotal, // Total for the line item (price * quantity)
                special_instructions: specialInstructionsInput || null,
                selected_options: cart_item_options,
            };

            // Check if cart needs truck name update
            if (!cartMetadata.food_truck_uid) {
                dispatch(set_cart_truck_name(truckName));
            }

            // Dispatch add item action (reducer handles clearing if truck mismatch)
            dispatch(add_cart_item(new_cart_item));
            dispatch(add_notification({ type: 'success', message: `${itemDetails.item_name} added to cart.` }));
            onClose(); // Close the modal
        } else {
             dispatch(add_notification({ type: 'warning', message: `Please make required selections.` }));
        }
    };

    const cancel_customization = () => {
        onClose();
    };

    // --- Render Logic ---
    if (!itemDetails) {
        // Optional: Show loading state or placeholder if itemDetails can be null during load
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
                    <p className="text-center text-gray-500">Loading item details...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Modal container */}
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
                <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-4 border-b pb-3">
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-800">{itemDetails.item_name}</h2>
                            {itemDetails.description && (
                                <p className="text-sm text-gray-600 mt-1">{itemDetails.description}</p>
                            )}
                        </div>
                        <button
                            onClick={cancel_customization}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Close customization"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Base Price */}
                    <p className="text-sm text-gray-500 mb-4">
                        Base price: ${itemDetails.base_price.toFixed(2)}
                    </p>

                    {/* Modifier Groups */}
                    <div className="space-y-5 mb-6">
                        {itemDetails.modifier_groups.map((group) => (
                            <div key={group.group_uid} className="border border-gray-200 rounded-lg p-4">
                                <h3 className="text-lg font-medium text-gray-700 mb-3">
                                    {group.group_name}
                                    {group.is_required && <span className="text-red-500 ml-1">*</span>}
                                </h3>
                                {validationErrors[group.group_uid] && (
                                    <p className="text-xs text-red-500 mb-2">{validationErrors[group.group_uid]}</p>
                                )}
                                <div className="space-y-2">
                                    {group.options.map((option) => (
                                        <label key={option.option_uid} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                                            {group.selection_type === 'single' ? (
                                                <input
                                                    type="radio"
                                                    name={`group-${group.group_uid}`}
                                                    value={option.option_uid}
                                                    checked={selectedOptions[group.group_uid] === option.option_uid}
                                                    onChange={() => handle_option_change(group.group_uid, option.option_uid, 'single')}
                                                    className="form-radio h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                />
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    value={option.option_uid}
                                                    checked={(selectedOptions[group.group_uid] as string[] || []).includes(option.option_uid)}
                                                    onChange={() => handle_option_change(group.group_uid, option.option_uid, 'multiple')}
                                                    className="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                />
                                            )}
                                            <span className="text-sm text-gray-800 flex-grow">{option.option_name}</span>
                                            {option.price_adjustment > 0 && (
                                                <span className="text-sm text-gray-600">+${option.price_adjustment.toFixed(2)}</span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center justify-between mb-5 border-t pt-5">
                        <label htmlFor="quantity" className="text-lg font-medium text-gray-700">Quantity</label>
                        <div className="flex items-center space-x-2 border border-gray-300 rounded-md">
                             <button
                                onClick={decrement_quantity}
                                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                                aria-label="Decrease quantity"
                                disabled={currentQuantity <= 1}
                            >
                                &ndash;
                            </button>
                            <input
                                type="number"
                                id="quantity"
                                name="quantity"
                                value={currentQuantity}
                                onChange={handle_quantity_change}
                                min="1"
                                className="w-12 text-center border-none focus:ring-0 py-1.5"
                                aria-label="Current quantity"
                            />
                             <button
                                onClick={increment_quantity}
                                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-r-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Special Instructions */}
                    <div className="mb-6">
                        <label htmlFor="special-instructions" className="block text-lg font-medium text-gray-700 mb-2">
                            Special Instructions <span className="text-sm text-gray-500">(optional)</span>
                        </label>
                        <textarea
                            id="special-instructions"
                            name="special-instructions"
                            rows={3}
                            value={specialInstructionsInput}
                            onChange={handle_special_instructions_change}
                            placeholder="e.g., No onions, extra napkins..."
                            className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                        />
                    </div>

                    {/* Footer with Total and Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-200 space-y-4 sm:space-y-0">
                        <div className="text-xl font-bold text-gray-900">
                            Total: ${calculatedItemTotal.toFixed(2)}
                        </div>
                        <div className="flex space-x-3 w-full sm:w-auto">
                             <button
                                type="button"
                                onClick={cancel_customization}
                                className="flex-1 sm:flex-none justify-center py-2 px-5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={validate_and_add_to_cart}
                                className="flex-1 sm:flex-none justify-center py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                                // disabled={Object.keys(validationErrors).length > 0} // Optionally disable if errors exist
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default UV_CustomerItemCustomization;