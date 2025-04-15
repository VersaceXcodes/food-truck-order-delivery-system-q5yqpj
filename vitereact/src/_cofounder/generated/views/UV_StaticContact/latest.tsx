import React from 'react';

// Define the interface for the static page content, based on the datamap schema
interface PageContent {
  title: string;
  contactEmail?: string;
  contactPhone?: string;
  additionalInfo?: string;
}

/**
 * UV_StaticContact View Component
 *
 * Displays static contact information for the StreetEats Hub platform.
 * Linked from the footer (GV_Footer).
 */
const UV_StaticContact: React.FC = () => {
  // Static content defined based on the datamap default values
  const page_content: PageContent = {
    title: 'Contact Us',
    contactEmail: 'support@streeteats.example',
    contactPhone: '1-800-EAT-NOW',
    additionalInfo:
      'For order-specific issues, please try contacting the food truck directly via the phone number provided on your active order page (if available).',
  };

  return (
    <>
      <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20">
        <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md">
          {/* Page Title */}
          <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-3">
            {page_content.title}
          </h1>

          {/* Contact Information Section */}
          <div className="space-y-4 text-gray-700">
            <p className="text-lg">
              If you have general questions about StreetEats Hub, need help with your account (not related to a specific order), or have business inquiries, please reach out to us:
            </p>

            {/* Email Contact */}
            {page_content.contactEmail && (
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                  />
                  <path
                    d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                  />
                </svg>
                <a
                  href={`mailto:${page_content.contactEmail}`}
                  className="text-blue-600 hover:underline hover:text-blue-800 transition duration-150 ease-in-out"
                >
                  {page_content.contactEmail}
                </a>
              </div>
            )}

            {/* Phone Contact */}
            {page_content.contactPhone && (
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
                  />
                </svg>
                <a
                  href={`tel:${page_content.contactPhone.replace(/\D/g, '')}`} // Remove non-digits for tel link
                  className="text-blue-600 hover:underline hover:text-blue-800 transition duration-150 ease-in-out"
                >
                  {page_content.contactPhone}
                </a>
              </div>
            )}

            {/* Additional Info */}
            {page_content.additionalInfo && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm text-gray-600 italic">
                  <span className="font-semibold">Important Note:</span> {page_content.additionalInfo}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_StaticContact;