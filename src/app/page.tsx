"use client";

const Home = () => {
  const loading = true;

  return loading ? (
    <section className="container mt-10 flex flex-col items-center gap-3 text-center md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:-translate-x-1/2 md:-translate-y-1/2">
      <p>Carregando...</p>
    </section>
  ) : (
    <h1>Participants Page</h1>
  );
};

export default Home;
