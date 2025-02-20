import { ModeToggle } from "@/components/theme/mode-toggle";


export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pages = [
    { name: "Assistant", url: "/assistant" },
    { name: "Exercise", url: "/exercise" },
    { name: "Follow Up", url: "/followup" },
    { name: "Patient Data", url: "/patientdata" },
  ];

  return (
    <html lang="en">
      <body className="flex flex-col w-full items-center">
        {/* NAVBAR */}
        <div className="">
          <nav className="">
            <ul key='list' className="flex flex-row gap-3 mt-5 border border-gray-500 rounded-3xl p-3 shadow-xl  ">
              {pages.map((page) => {
                return (
                  <li key={page.name} className="border hover:bg-gray-400 border-gray-500 text-lg rounded-2xl p-2 italic  ">
                    <a key={page.url} href={page.url}>{page.name}</a>
                  </li>
                );
              })}
            </ul>
        
          </nav>
        </div>

        {children}
      </body>
    </html>
  );
}
