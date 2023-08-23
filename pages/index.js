import Head from "next/head";
import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";
import { getSession } from "@auth0/nextjs-auth0";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot } from "@fortawesome/free-solid-svg-icons";

export const getServerSideProps = async (context) => {
  const session = await getSession(context.req, context.res);

  if (session) {
    return {
      redirect: {
        destination: "/chat",
      },
    };
  }

  return {
    props: {},
  };
};

export default function Home() {
  const { error, isLoading, user } = useUser();

  return (
    <>
      <Head>
        <title>AI Pal</title>
      </Head>
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-800 text-center text-white">
        <div>
          <div>
            <FontAwesomeIcon
              icon={faRobot}
              className="mb-2 text-6xl text-emerald-200"
            />
          </div>
          <h1 className="text-5xl font-bold">Welcome to ChatGPT</h1>
          <p className="mt-2 text-lg">Log in with your account to continue</p>
          <div className="mt-4 flex justify-center gap-3">
            {!user && (
              <>
                <Link href="/api/auth/login" className="btn">
                  Login
                </Link>
                <Link href="/api/auth/signup" className="btn">
                  Signup
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
