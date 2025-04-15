import React from 'react';
// No Link import needed as this is purely static content display based on requirements.

/**
 * UV_StaticAbout View Component
 * @description Displays static information about the StreetEats Hub platform.
 * @returns {React.ReactElement} The About Us page component.
 */
const UV_StaticAbout: React.FC = () => {
  // The component renders static content about the platform.
  // It uses Tailwind CSS for styling.
  // Placeholder text and images are used.

  return (
    <>
      <div className="bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">

          {/* Page Title */}
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
            About StreetEats Hub
          </h1>

          {/* Introduction Paragraph */}
          <p className="text-lg text-gray-700 leading-relaxed mb-8">
            Welcome to StreetEats Hub, your ultimate guide to discovering and enjoying the vibrant world of food trucks right in your neighborhood! We believe that some of the best culinary experiences come from passionate chefs serving up incredible food on wheels. Our mission is to connect hungry customers like you with the diverse and delicious offerings of local food truck operators.
          </p>

          {/* Placeholder Image 1 */}
          <div className="my-10 text-center">
            <img
              src="https://picsum.photos/seed/streeteats_about1/800/400"
              alt="Vibrant food truck scene"
              className="rounded-lg shadow-lg inline-block"
              width="800"
              height="400"
            />
          </div>

          {/* Our Vision Section */}
          <h2 className="text-3xl font-semibold text-gray-800 mb-4 mt-10">
            Our Vision
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            We envision a world where finding your next favorite meal from a food truck is effortless and exciting. StreetEats Hub aims to be the central platform that empowers food truck entrepreneurs to reach more customers and provides food lovers with a seamless way to explore, order, and enjoy unique street food flavors. Whether you're craving tacos, gourmet burgers, vegan delights, or exotic cuisines, we want to make it easy for you to find and support these mobile culinary artists.
          </p>

          {/* How It Works Section */}
          <h2 className="text-3xl font-semibold text-gray-800 mb-4 mt-10">
            How It Works
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            StreetEats Hub provides a simple, intuitive platform for both customers and food truck operators:
          </p>
          <ul className="list-disc list-inside text-lg text-gray-700 leading-relaxed mb-8 space-y-2">
            <li>
              <strong>Discover:</strong> Find food trucks near you using our interactive map or list view. Filter by cuisine type or search for your favorites.
            </li>
            <li>
              <strong>Browse & Customize:</strong> Explore detailed menus, view photos, and customize your order exactly how you like it.
            </li>
            <li>
              <strong>Order & Pay:</strong> Easily place orders for pickup or delivery (where available) and pay securely online.
            </li>
            <li>
              <strong>Track:</strong> Follow your order status in real-time, from preparation to ready for pickup or out for delivery.
            </li>
            <li>
              <strong>Manage (For Operators):</strong> Food truck owners get a simple dashboard to manage their menu, location, hours, and incoming orders efficiently.
            </li>
          </ul>

          {/* Placeholder Image 2 */}
          <div className="my-10 text-center">
            <img
              src="https://picsum.photos/seed/streeteats_about2/700/350"
              alt="Ordering food from a phone"
              className="rounded-lg shadow-lg inline-block"
              width="700"
              height="350"
            />
          </div>

          {/* Join Us Section */}
          <h2 className="text-3xl font-semibold text-gray-800 mb-4 mt-10">
            Join the StreetEats Community
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-8">
            We're passionate about food and the entrepreneurial spirit of food truck owners. StreetEats Hub is more than just an app; it's a community built around the love for great street food. We are constantly working to improve the platform and add new features to enhance your experience. Thank you for being a part of our journey!
          </p>

          {/* Optional: Add team info or contact link here if desired */}
          {/*
          <p className="text-center text-gray-600 mt-12">
            Have questions? <Link to="/contact" className="text-indigo-600 hover:text-indigo-800 font-medium">Contact Us</Link>.
          </p>
          */}

        </div>
      </div>
    </>
  );
};

export default UV_StaticAbout;