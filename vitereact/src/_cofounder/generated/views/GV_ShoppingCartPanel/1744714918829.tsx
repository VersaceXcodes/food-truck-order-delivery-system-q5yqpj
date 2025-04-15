import React, { useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  RootState,
  update_cart_item,
  remove_cart_item,
  CartItem,
  CartItemOption,
} from '@/store/main'; // Assuming types are exported from store

// Define component props
interface GV_ShoppingCartPanelProps {
  is_open: boolean;
  on_close: () => void;
}

const GV_ShoppingCartPanel: React.FC<GV_ShoppingCartPanelProps> = ({ is_open, on_close }) => {
  const dispatch = useDispatch();
  const cart_items = useSelector((state: RootState) => state.cart.items);
  const cart_metadata = useSelector((state: RootState) => state.cart.cart_metadata);

  const TAX_RATE = 0.09; // 9% Tax Rate for MVP

  // --- Derived State Calculations ---

  const cart_subtotal = useMemo(() => {
    return cart_items.reduce((sum, item) => sum + item.total_item_price, 0);
  }, [cart_items]);

  const estimated_tax = useMemo(() => {
    return cart_subtotal * TAX_RATE;
  }, [cart_subtotal]);

  const delivery_fee = 0; // Placeholder for cart panel, actual fee applied at checkout

  const cart_total = useMemo(() => {
    return cart_subtotal + estimated_tax + delivery_fee;
  }, [cart_subtotal, estimated_tax, delivery_fee]);

  const is_checkout_enabled = useMemo(() => {
    return cart_items.length > 0;
  }, [cart_items]);

  // --- Action Handlers ---

  const handle_update_quantity = useCallback((cart_item_id: string, new_quantity: number) => {
    if (new_quantity < 1) return; // Prevent quantity less than 1

    const item = cart_items.find(i => i.cart_item_id === cart_item_id);
    if (!item) return;

    const options_price_sum = item.selected_options.reduce((sum, option) => sum + option.price_adjustment_snapshot, 0);
    const new_total_item_price = (item.base_price_snapshot + options_price_sum) * new_quantity;

    dispatch(update_cart_item({
      cart_item_id,
      updates: {
        quantity: new_quantity,
        total_item_price: new_total_item_price,
      }
    }));
  }, [dispatch, cart_items]);

  const handle_remove_item = useCallback((cart_item_id: string) => {
    dispatch(remove_cart_item(cart_item_id));
  }, [dispatch]);

  // --- Helper Functions ---

  const format_currency = (amount: number): string => {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const format_options = (options: CartItemOption[]): string => {
    if (!options || options.length === 0) return '';
    return options.map(opt => `${opt.option_name_snapshot}${opt.price_adjustment_snapshot > 0 ? ` (+${format_currency(opt.price_adjustment_snapshot)})` : ''}`).join(', ');
  };

  // Memoize the display items to avoid re-calculation on every render
    const cart_items_display = useMemo(() => {
      return cart_items.map(item => {
          const options_display_string = format_options(item.selected_options);
          const price_per_item = item.total_item_price / item.quantity; // Calculate price per single item with options
          return {
              ...item, // Spread original item data
              options_display: options_display_string,
              price_per_item: price_per_item,
              line_item_total: item.total_item_price,
          };
      });
  }, [cart_items]);


  // Render nothing if not open
  if (!is_open) {
    return null;
  }

  // --- Main Render ---
  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-in-out"
        onClick={on_close}
        aria-hidden="true"
      ></div>

      {/* Sidebar Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Your Cart {cart_metadata.food_truck_name ? `from ${cart_metadata.food_truck_name}` : ''}
          </h2>
          <button
            onClick={on_close}
            className="text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            aria-label="Close cart"
          >
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {cart_items_display.length === 0 ? (
            <p className="text-center text-gray-500 mt-10">Your cart is empty.</p>
          ) : (
            cart_items_display.map((item) => (
              <div key={item.cart_item_id} className="flex items-start space-x-4 border-b border-gray-100 pb-4 last:border-b-0">
                {/* Image Placeholder - Replace with actual image if available */}
                 {/* Assuming item might have a photo_url snapshot, otherwise use placeholder */}
                 <img
                    // src={item.photo_url || `https://picsum.photos/seed/${item.menu_item_uid}/64/64`}
                    src={`https://picsum.photos/seed/${item.menu_item_uid}/64/64`} // Use picsum placeholder as per requirement
                    alt={item.item_name_snapshot}
                    className="w-16 h-16 object-cover rounded flex-shrink-0"
                 />
                <div className="flex-grow">
                  <h3 className="text-sm font-medium text-gray-900">{item.item_name_snapshot}</h3>
                  {item.options_display && (
                    <p className="text-xs text-gray-500 mt-1">{item.options_display}</p>
                  )}
                  {item.special_instructions && (
                    <p className="text-xs text-gray-500 italic mt-1">"{item.special_instructions}"</p>
                  )}
                   <p className="text-xs text-gray-500 mt-1">
                        {format_currency(item.price_per_item)} each
                   </p>
                  <div className="flex justify-between items-center mt-2">
                    {/* Quantity Stepper */}
                    <div className="flex items-center border border-gray-300 rounded">
                      <button
                        onClick={() => handle_update_quantity(item.cart_item_id, item.quantity - 1)}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="px-3 text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handle_update_quantity(item.cart_item_id, item.quantity + 1)}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    {/* Remove Button */}
                    <button
                      onClick={() => handle_remove_item(item.cart_item_id)}
                      className="text-xs text-red-600 hover:text-red-800 focus:outline-none"
                      aria-label={`Remove ${item.item_name_snapshot}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                 {/* Line Item Total */}
                 <div className="text-sm font-medium text-gray-900 flex-shrink-0 ml-4">
                      {format_currency(item.line_item_total)}
                 </div>
              </div>
            ))
          )}
        </div>

        {/* Order Summary & Checkout */}
        {cart_items_display.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="space-y-1 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{format_currency(cart_subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax ({ (TAX_RATE * 100).toFixed(0) }%)</span>
                <span>{format_currency(estimated_tax)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery Fee</span>
                <span>TBD at checkout</span>
              </div>
              <div className="flex justify-between text-base font-medium text-gray-900 pt-2 border-t border-gray-200 mt-2">
                <span>Total</span>
                <span>{format_currency(cart_total)}</span>
              </div>
            </div>
            <div className="mt-6">
              <Link
                to="/checkout"
                onClick={(e) => { if (!is_checkout_enabled) e.preventDefault(); on_close(); }} // Close panel on click
                className={`w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${
                  is_checkout_enabled
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                aria-disabled={!is_checkout_enabled}
                tabIndex={is_checkout_enabled ? 0 : -1}
              >
                Checkout
              </Link>
            </div>
             <div className="mt-4 text-center">
                <button
                    onClick={on_close}
                    className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                >
                    or Continue Shopping <span aria-hidden="true"> &rarr;</span>
                </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GV_ShoppingCartPanel;