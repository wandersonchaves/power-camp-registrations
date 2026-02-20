import React from "react";
import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <nav>
      <ul className="mt-4 flex h-8 items-center justify-center -space-x-px text-sm">
        <li>
          <Link
            href={currentPage === 1 ? "#" : "#"}
            onClick={(e) => {
              if (currentPage === 1) {
                e.preventDefault();
              } else {
                onPageChange(currentPage - 1);
              }
            }}
            className={`ms-0 flex h-8 items-center justify-center rounded-s-lg border border-e-0 border-gray-300 px-3 leading-tight ${
              currentPage === 1
                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                : "bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}
          >
            <span className="sr-only">Previous</span>
            <svg
              className="size-2.5 rtl:rotate-180"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 6 10"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 1 1 5l4 4"
              />
            </svg>
          </Link>
        </li>

        {Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;

          return (
            <li key={page}>
              <Link
                href="#"
                className={`flex h-8 items-center justify-center border px-3 leading-tight ${
                  page === currentPage
                    ? "z-10 border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  if (page !== currentPage) {
                    onPageChange(page);
                  }
                }}
              >
                {page}
              </Link>
            </li>
          );
        })}

        <li>
          <Link
            href={currentPage === totalPages ? "#" : "#"}
            onClick={(e) => {
              if (currentPage === totalPages) {
                e.preventDefault();
              } else {
                onPageChange(currentPage + 1);
              }
            }}
            className={`flex h-8 items-center justify-center rounded-e-lg border border-gray-300 px-3 leading-tight ${
              currentPage === totalPages
                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                : "bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}
          >
            <span className="sr-only">Next</span>
            <svg
              className="size-2.5 rtl:rotate-180"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 6 10"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m1 9 4-4-4-4"
              />
            </svg>
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;
